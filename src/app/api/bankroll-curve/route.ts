import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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
  const periodParam = searchParams.get('period');
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');
  const hoursFromParam = searchParams.get('hoursFrom');
  const hoursToParam = searchParams.get('hoursTo');
  const buyInsParam = searchParams.getAll('buyIns');
  const debugParam = searchParams.get('debug');
  // Bankroll curve only respects date/time and buy-ins filters

  let dateFrom: Date | undefined = dateFromParam ? new Date(dateFromParam) : undefined;
  let dateTo: Date | undefined = dateToParam ? new Date(dateToParam) : undefined;
  if (!dateFrom && !dateTo && periodParam) {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const dayOfWeek = now.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    switch (periodParam) {
      case 'today': {
        dateFrom = startOfDay(now);
        dateTo = endOfDay(now);
        break;
      }
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        dateFrom = startOfDay(y);
        dateTo = endOfDay(y);
        break;
      }
      case 'this-week': {
        const start = new Date(now);
        start.setDate(now.getDate() - mondayOffset);
        dateFrom = startOfDay(start);
        dateTo = endOfDay(now);
        break;
      }
      case 'this-month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFrom = startOfDay(start);
        dateTo = endOfDay(now);
        break;
      }
      default:
        break;
    }
  }

  const buyIns = buyInsParam
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n));

  const items = await prisma.tournament.findMany({
    where: {
      userId,
      ...(buyIns.length > 0 ? { buyInCents: { in: buyIns } } : {}),
      ...(dateFrom || dateTo
        ? {
            startedAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: 'asc' },
    select: { id: true, startedAt: true, profitCents: true, prizePoolCents: true, buyInCents: true },
  });

  // Optional hours-of-day filter on tournament start time (UTC)
  let filtered = items;
  if (hoursFromParam && hoursToParam) {
    const parseHhMm = (s: string) => {
      const [hh, mm] = s.split(':').map((v) => parseInt(v, 10));
      return (Math.max(0, Math.min(23, hh || 0)) * 60) + (Math.max(0, Math.min(59, mm || 0)));
    };
    const fromMin = parseHhMm(hoursFromParam);
    const toMin = parseHhMm(hoursToParam);
    const inRange = (d: Date) => {
      const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      if (fromMin <= toMin) return minutes >= fromMin && minutes < toMin; // [from, to)
      return minutes >= fromMin || minutes < toMin; // wrap around
    };
    filtered = items.filter((t) => (t.startedAt ? inRange(t.startedAt) : false));
  }

  // Compute per-tournament CEV sum (chips) across selected tournaments
  const tournamentIds = filtered.map((t) => t.id);
  const cevByTournament = new Map<string, number>();
  const startByTournament = new Map<string, number>();
  if (tournamentIds.length > 0) {
    const grouped = await prisma.hand.groupBy({
      by: ['tournamentId'],
      where: { tournamentId: { in: tournamentIds } },
      _sum: { evAllInAdjCents: true, evRealizedCents: true },
    });
    for (const g of grouped as Array<{ tournamentId: string; _sum: { evAllInAdjCents: number | null; evRealizedCents: number | null } }>) {
      const adj = g._sum.evAllInAdjCents;
      const realized = g._sum.evRealizedCents;
      const cev = (adj != null ? adj : realized) ?? 0;
      cevByTournament.set(g.tournamentId, Math.round(cev));
    }
    // Read starting stacks from earliest hands per tournament (prefer hero's startingStackCents)
    const hands = await prisma.hand.findMany({
      where: { tournamentId: { in: tournamentIds } },
      orderBy: [
        { playedAt: 'asc' },
        { handNo: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        tournamentId: true,
        players: { select: { isHero: true, startingStackCents: true } },
      },
    });
    const seen = new Set<string>();
    for (const h of hands) {
      const tid = h.tournamentId as string;
      if (seen.has(tid)) continue;
      seen.add(tid);
      const heroStart = h.players.find((p) => p.isHero)?.startingStackCents ?? null;
      if (heroStart && heroStart > 0) {
        startByTournament.set(tid, heroStart);
      } else {
        const anyStart = h.players.map((p) => p.startingStackCents ?? 0).filter((v) => v > 0);
        if (anyStart.length > 0) startByTournament.set(tid, anyStart[0]!);
      }
    }
  }

  const STARTING_CHIPS_FALLBACK = 500; // default per player (can be 300 on some stakes)
  const PLAYERS_PER_GAME = 3;

  let cum = 0;
  let cumExp = 0;
  const points: Array<{ tournamentId: string; startedAt: string | null; cumProfitCents: number; cumExpectedCents: number }> = [];
  const debugEntries: Array<Record<string, unknown>> = [];
  for (const t of filtered) {
    const delta = t.profitCents ?? 0;
    cum += delta;
    const cev = cevByTournament.get(t.id) ?? 0; // chips (cents-based unit)
    const startChips = startByTournament.get(t.id) ?? STARTING_CHIPS_FALLBACK;
    const players = PLAYERS_PER_GAME;
    const denom = players * startChips;
    const winPctRaw = denom > 0 ? (startChips + cev) / denom : 0;
    const winPct = Math.max(0, Math.min(1, winPctRaw));
    const prizePoolCents = t.prizePoolCents ?? 0;
    const buyInCents = t.buyInCents ?? 0;
    // Expected net profit = expected payout - buy-in (pas d'arrondi par tournoi)
    const exp = (prizePoolCents * winPct) - buyInCents;
    cumExp += exp;
    points.push({
      tournamentId: t.id,
      startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : null,
      cumProfitCents: cum,
      cumExpectedCents: cumExp,
    });
    if (debugParam === '1') {
      debugEntries.push({
        tournamentId: t.id,
        startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : null,
        cevChips: cev,
        players,
        startChips,
        prizePoolCents,
        buyInCents,
        winPctRaw,
        winPct,
        winPctWasClamped: Math.max(0, Math.min(1, winPctRaw)) !== winPctRaw,
        expectedNetCents: exp,
        cumExpectedCents: cumExp,
      });
    }
  }

  if (debugParam === '1') {
    // Log a compact summary and return details in response
    try {
      console.info('[bankroll-curve][debug] entries', debugEntries.slice(0, 5));
    } catch {
      // ignore logging failures
    }
    return NextResponse.json({ points, debug: debugEntries });
  }

  return NextResponse.json({ points });
}


