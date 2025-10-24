import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

function parseCursor(input: string | null): { playedAt: Date; handNo: string | null; id: string } | null {
  if (!input) return null;
  try {
    const obj = JSON.parse(Buffer.from(input, 'base64').toString('utf8')) as { playedAt: string | null; handNo: string | null; id: string };
    return { playedAt: obj.playedAt ? new Date(obj.playedAt) : new Date(0), handNo: obj.handNo, id: obj.id };
  } catch {
    return null;
  }
}

function makeCursor(row: { playedAt: Date | null; handNo: string | null; id: string }): string {
  const payload = { playedAt: row.playedAt?.toISOString() ?? null, handNo: row.handNo ?? null, id: row.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export async function GET(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id ?? null;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  if (!userId && allowDevFallback) {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = Math.max(1, Math.min(10000, limitParam ? parseInt(limitParam, 10) || 10000 : 10000));
  const cursorParam = searchParams.get('cursor');

  const periodParam = searchParams.get('period');
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');
  const hoursFromParam = searchParams.get('hoursFrom');
  const hoursToParam = searchParams.get('hoursTo');
  const positionParam = searchParams.get('position'); // 'hu' | '3max'
  const huRolesParam = searchParams.getAll('huRole'); // sb|bb
  const m3RolesParam = searchParams.getAll('m3Role'); // bu|sb|bb
  const effMinParam = searchParams.get('effMin');
  const effMaxParam = searchParams.get('effMax');
  const buyInsParam = searchParams.getAll('buyIns');
  const phaseParam = searchParams.get('phase'); // 'preflop' | 'postflop'

  let dateFrom: Date | undefined = dateFromParam ? new Date(dateFromParam) : undefined;
  let dateTo: Date | undefined = dateToParam ? new Date(dateToParam) : undefined;
  if (!dateFrom && !dateTo && periodParam) {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    if (periodParam === 'today') {
      dateFrom = startOfDay(now);
      dateTo = endOfDay(now);
    } else if (periodParam === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 3600 * 1000);
      dateFrom = startOfDay(y);
      dateTo = endOfDay(y);
    } else if (periodParam === 'this-week') {
      const day = now.getUTCDay();
      const diff = (day + 6) % 7; // Monday as start
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - diff);
      dateFrom = startOfDay(monday);
      dateTo = endOfDay(now);
    } else if (periodParam === 'this-month') {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      dateFrom = startOfDay(first);
      dateTo = endOfDay(now);
    }
  }

  const timeFilter = hoursFromParam && hoursToParam ? { from: hoursFromParam, to: hoursToParam } : null;

  const after = parseCursor(cursorParam);
  const buyIns = buyInsParam
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n));

  const rows = await prisma.hand.findMany({
    where: {
      tournament: {
        userId,
        ...(buyIns.length > 0 ? { buyInCents: { in: buyIns } } : {}),
      },
      ...(dateFrom || dateTo ? { playedAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    },
    orderBy: [
      { playedAt: 'asc' },
      { handNo: 'asc' },
      { createdAt: 'asc' },
    ],
    ...(after
      ? {
          cursor: { id: after.id },
          skip: 1,
        }
      : {}),
    take: limit,
    select: {
      id: true,
      handNo: true,
      playedAt: true,
      heroSeat: true,
      players: { select: { seat: true, isHero: true, startingStackCents: true } },
      actions: { select: { street: true, seat: true, orderNo: true, sizeCents: true } },
      sbCents: true,
      bbCents: true,
    },
  });

  let filtered = rows;
  if (timeFilter) {
    const parseHhMm = (s: string) => {
      const [hh, mm] = s.split(':').map((v) => parseInt(v, 10));
      return Math.max(0, Math.min(23, hh || 0)) * 60 + Math.max(0, Math.min(59, mm || 0));
    };
    const fromMin = parseHhMm(timeFilter.from);
    const toMin = parseHhMm(timeFilter.to);
    const inRange = (d: Date) => {
      const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      if (fromMin <= toMin) return minutes >= fromMin && minutes < toMin; // [from, to)
      return minutes >= fromMin || minutes < toMin; // wrap-around
    };
    filtered = rows.filter((r) => (r.playedAt ? inRange(r.playedAt) : false));
  }

  if (positionParam === 'hu' || positionParam === '3max') {
    const wantCount = positionParam === 'hu' ? 2 : 3;
    filtered = filtered.filter((r: any) => Array.isArray(r.players) ? r.players.length === wantCount : false);
    // Sub-role filtering using preflop action order
    if (positionParam === 'hu' && (huRolesParam.includes('sb') || huRolesParam.includes('bb'))) {
      filtered = filtered.filter((r: any) => {
        const heroSeat = (r.players?.find((p: any) => p.isHero)?.seat) ?? r.heroSeat ?? null;
        if (heroSeat == null) return false;
        const pre = (r.actions || []).filter((a: any) => a.street === 'preflop' && a.seat != null);
        const sbSeat = r.sbCents != null ? (pre.find((a: any) => a.sizeCents === r.sbCents)?.seat ?? null) : null;
        if (sbSeat == null) return false;
        const heroIsSb = sbSeat === heroSeat;
        if (heroIsSb && huRolesParam.includes('sb')) return true;
        if (!heroIsSb && huRolesParam.includes('bb')) return true;
        return false;
      });
    }
    if (positionParam === '3max' && (m3RolesParam.includes('bu') || m3RolesParam.includes('sb') || m3RolesParam.includes('bb'))) {
      filtered = filtered.filter((r: any) => {
        const heroSeat = (r.players?.find((p: any) => p.isHero)?.seat) ?? r.heroSeat ?? null;
        if (heroSeat == null) return false;
        const pre = (r.actions || []).filter((a: any) => a.street === 'preflop' && a.seat != null);
        const sbSeat = r.sbCents != null ? (pre.find((a: any) => a.sizeCents === r.sbCents)?.seat ?? null) : null;
        const bbSeat = r.bbCents != null ? (pre.find((a: any) => a.sizeCents === r.bbCents)?.seat ?? null) : null;
        if (sbSeat == null || bbSeat == null) return false;
        const seats = new Set((r.players || []).map((p: any) => p.seat));
        const btnSeat = Array.from(seats).find((s: any) => s !== sbSeat && s !== bbSeat) ?? null;
        let role: 'bu' | 'sb' | 'bb' | null = null;
        if (heroSeat === btnSeat) role = 'bu';
        else if (heroSeat === sbSeat) role = 'sb';
        else if (heroSeat === bbSeat) role = 'bb';
        if (!role) return false;
        return m3RolesParam.includes(role);
      });
    }
  }

  // Phase filter
  if (phaseParam === 'preflop') {
    filtered = filtered.filter((r: any) => !(r.actions || []).some((a: any) => a.street === 'flop' || a.street === 'turn' || a.street === 'river'));
  } else if (phaseParam === 'postflop') {
    filtered = filtered.filter((r: any) => (r.actions || []).some((a: any) => a.street === 'flop'));
  }

  // Effective stack filter (hero starting stack / BB)
  if (effMinParam != null || effMaxParam != null) {
    const minBB = effMinParam != null ? Number(effMinParam) : -Infinity;
    const maxBB = effMaxParam != null ? Number(effMaxParam) : Infinity;
    filtered = filtered.filter((r: any) => {
      const heroSeat = (r.players?.find((p: any) => p.isHero)?.seat) ?? r.heroSeat ?? null;
      const bb = r.bbCents ?? null;
      if (heroSeat == null || bb == null || bb <= 0) return false;
      const stacks = (r.players || []).map((p: any) => ({ seat: p.seat, stack: p.startingStackCents ?? 0 })).filter((p: any) => (p.stack ?? 0) > 0);
      const heroStart = stacks.find((p: any) => p.seat === heroSeat)?.stack ?? 0;
      const others = stacks.filter((p: any) => p.seat !== heroSeat).map((p: any) => p.stack);
      if (heroStart <= 0 || others.length === 0) return false;
      const maxOther = Math.max(...others);
      const effChips = others.length === 1 ? Math.min(heroStart, others[0]!) : Math.min(heroStart, maxOther);
      const effBB = effChips / bb;
      return effBB >= minBB && effBB <= maxBB;
    });
  }

  const ids = filtered.map((r) => r.id);
  const nextCursor = filtered.length > 0 ? makeCursor(filtered[filtered.length - 1]) : null;
  return NextResponse.json({ ids, nextCursor });
}


