import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { getEvCurve, computeHandEv } from '@/server/ev';
import { computeHandEvForRecord, type HandLike, type HandEv } from '@/server/evHelpers';
import { estimateMultiwayEquity } from '@/lib/poker/equity';
import type { Hand, Action, HandPlayer } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

const makeSeededRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

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
  const parsedLimit = limitParam != null ? Number(limitParam) : undefined;
  const limit = parsedLimit != null && Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : undefined;
  const seedParam = searchParams.get('seed');
  const sampParam = searchParams.get('samp');
  const timingsParam = searchParams.get('timings');
  const periodParam = searchParams.get('period');
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');
  const hoursFromParam = searchParams.get('hoursFrom');
  const hoursToParam = searchParams.get('hoursTo');
  const options = {
    seed: seedParam ? parseInt(seedParam, 10) : undefined,
    samples: sampParam ? parseInt(sampParam, 10) : undefined,
    collectTimings: timingsParam === '1',
  };
  // Explicit range overrides period when provided
  let dateFrom: Date | undefined = dateFromParam ? new Date(dateFromParam) : undefined;
  let dateTo: Date | undefined = dateToParam ? new Date(dateToParam) : undefined;
  // Map period to date range (inclusive day bounds) if no explicit dates
  if (!dateFrom && !dateTo && periodParam) {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
    const mondayOffset = (dayOfWeek + 6) % 7; // 0 for Monday
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

  const data = await getEvCurve(userId, limit, { ...options, dateFrom, dateTo, hoursFrom: hoursFromParam ?? undefined, hoursTo: hoursToParam ?? undefined });

  if (searchParams.get('debug') === '2') {
    const HAND_DEBUG_SELECT = {
      id: true,
      handNo: true,
      playedAt: true,
      heroSeat: true,
      winnerSeat: true,
      dealtCards: true,
      board: true,
      boardFlop: true,
      boardTurn: true,
      boardRiver: true,
      totalPotCents: true,
      mainPotCents: true,
      actions: {
        select: {
          orderNo: true,
          seat: true,
          type: true,
          sizeCents: true,
          street: true,
          isAllIn: true,
        },
      },
      players: {
        select: {
          seat: true,
          isHero: true,
          hole: true,
          startingStackCents: true,
        },
      },
    } as const;

    type HandDebugRow = {
      id: string;
      handNo: string | null;
      playedAt: Date | null;
      heroSeat: number | null;
      winnerSeat: number | null;
      dealtCards: string | null;
      board: string | null;
      boardFlop: string | null;
      boardTurn: string | null;
      boardRiver: string | null;
      totalPotCents: number | null;
      mainPotCents: number | null;
      actions: Array<{
        orderNo: number;
        seat: number | null;
        type: 'check' | 'fold' | 'call' | 'bet' | 'raise' | 'push';
        sizeCents: number | null;
        street: 'preflop' | 'flop' | 'turn' | 'river';
        isAllIn: boolean | null;
      }>;
      players: Array<{
        seat: number;
        isHero: boolean | null;
        hole: string | null;
        startingStackCents: number | null;
      }>;
    };

    const hands = await prisma.hand.findMany({
      where: { tournament: { userId } },
      orderBy: [
        { playedAt: 'asc' },
        { handNo: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
      select: HAND_DEBUG_SELECT,
    }) as HandDebugRow[];

    const toHandLike = (handRow: HandDebugRow): HandLike => ({
      id: handRow.id,
      playedAt: handRow.playedAt ?? null,
      heroSeat: handRow.heroSeat ?? null,
      winnerSeat: handRow.winnerSeat ?? null,
      dealtCards: handRow.dealtCards ?? null,
      board: handRow.board ?? null,
      boardFlop: handRow.boardFlop ?? null,
      boardTurn: handRow.boardTurn ?? null,
      boardRiver: handRow.boardRiver ?? null,
      totalPotCents: handRow.totalPotCents ?? null,
      mainPotCents: handRow.mainPotCents ?? null,
      actions: handRow.actions.map((a) => ({
        orderNo: a.orderNo,
        seat: a.seat === 0 ? null : a.seat,
        type: a.type,
        sizeCents: a.sizeCents ?? null,
        street: a.street,
        isAllIn: a.isAllIn ?? null,
      })),
      players: handRow.players.map((p) => ({
        seat: p.seat,
        isHero: p.isHero ?? false,
        hole: p.hole ?? null,
        startingStackCents: p.startingStackCents ?? null,
      })),
    });

    const computeSeatEquities = (handEv: HandEv, base: { seed?: number; samples?: number }): Record<number, number> | null => {
      const context = handEv.allInContext;
      if (!context) return null;
      const participants = context.participants.filter((p): p is { seat: number; hole: [string, string] } =>
        Array.isArray(p.hole) && p.hole.length === 2,
      );
      if (participants.length < 2) return null;
      const board = context.board;
      const samples = Math.max(1, base.samples ?? 10000);
      const result: Record<number, number> = {};
      participants.forEach((participant, idx) => {
        const others = participants.filter((_, j) => j !== idx).map((p) => p.hole);
        const rng = base.seed != null ? makeSeededRng(base.seed + participant.seat * 31 + idx) : Math.random;
        const equity = estimateMultiwayEquity(participant.hole, others, board, samples, rng);
        const totalParticipants = others.length + 1;
        const share = equity.winPct + (totalParticipants > 0 ? equity.tiePct / totalParticipants : 0);
        result[participant.seat] = Math.round(share * 1000) / 1000;
      });
      return result;
    };

    const baseOptions = { seed: options.seed, samples: options.samples };
    const rows: Array<Record<string, unknown>> = [];
    let cumActual = 0;
    let cumAdj = 0;
    for (const handRow of hands) {
      const ev = computeHandEvForRecord(toHandLike(handRow), baseOptions);
      const deltaActual = ev.realizedChangeCents ?? 0;
      const deltaAdj = ev.allInAdjustedChangeCents != null ? ev.allInAdjustedChangeCents : deltaActual;
      cumActual += deltaActual;
      cumAdj += deltaAdj;
      const seatEquities = computeSeatEquities(ev, baseOptions);
      const row: Record<string, unknown> = {
        handId: handRow.handNo ?? handRow.id,
        handNo: handRow.handNo ?? null,
        playedAt: handRow.playedAt ? new Date(handRow.playedAt).toISOString() : null,
        deltaActual,
        deltaAdj,
        cumActual,
        cumAdj,
        equities: ev.equities ?? null,
        equityBySeat: seatEquities ?? null,
      };
      if (seatEquities && handRow.heroSeat != null) {
        row.equityHero = seatEquities[handRow.heroSeat] ?? null;
        for (const [seatStr, share] of Object.entries(seatEquities)) {
          const seatNum = Number(seatStr);
          if (!Number.isFinite(seatNum)) continue;
          const key = seatNum === handRow.heroSeat ? 'equityHero' : `equityPlayer${seatNum}`;
          row[key] = share;
        }
      }
      rows.push(row);
    }
    return NextResponse.json({ rows, chipEvAdjTotal: cumAdj });
  }

  if (searchParams.get('debug') === '1') {
    const hands = await prisma.hand.findMany({
      where: { tournament: { userId } },
      orderBy: [
        { playedAt: 'asc' },
        { handNo: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
      include: { actions: true, players: true },
    });
    type DebugHand = Hand & { actions: Action[]; players: HandPlayer[]; mainPotCents: number | null };
    const details: Array<{
      handId: string;
      playedAt: string | null;
      heroHole: string | null;
      deltaAdj: number;
      deltaActual: number;
    }> = [];
    for (const h of hands as DebugHand[]) {
      const ev = await computeHandEv(h.id, { seed: seedParam ? parseInt(seedParam, 10) : undefined, samples: sampParam ? parseInt(sampParam, 10) : undefined });
      const heroSeat = h.heroSeat ?? h.players.find((p) => p.isHero)?.seat ?? null;
      const heroHoleStr = heroSeat != null ? (h.players.find((p) => p.seat === heroSeat)?.hole || h.dealtCards || null) : null;
      const deltaActual = ev.realizedChangeCents ?? 0;
      const deltaAdj = ev.allInAdjustedChangeCents != null ? ev.allInAdjustedChangeCents : deltaActual;
      details.push({
        handId: h.handNo ?? h.id,
        playedAt: h.playedAt ? new Date(h.playedAt).toISOString() : null,
        heroHole: heroHoleStr,
        deltaAdj,
        deltaActual,
      });
    }
    return NextResponse.json(details);
  }

  return NextResponse.json(data);
}
