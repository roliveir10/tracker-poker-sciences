import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import { performance } from 'node:perf_hooks';
import {
  computeHandEvForRecord,
  type EvOptions as BaseEvOptions,
  type HandEv,
  type HandLike,
} from './evHelpers';

export type EvOptions = BaseEvOptions & {
  collectTimings?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  hoursFrom?: string; // "HH:MM"
  hoursTo?: string;   // "HH:MM"
};

export type EvTimings = {
  totalMs: number;
  queryMs: number;
  computeMs: number;
  avgComputePerHandMs: number;
  topHandsByMs: Array<{ handId: string; durationMs: number }>;
};

export type { HandEv } from './evHelpers';

const SAMPLE_TIERS = [50, 100, 250] as const;
const DEFAULT_TARGET = 250;
const backgroundJobs = new Set<string>();

const normalizeSamples = (requested?: number): number => {
  const desired = requested != null && Number.isFinite(requested) ? requested : DEFAULT_TARGET;
  for (const tier of SAMPLE_TIERS) {
    if (desired <= tier) return tier;
  }
  return SAMPLE_TIERS[SAMPLE_TIERS.length - 1];
};

const HAND_SELECT = {
  id: true,
  handNo: true,
  playedAt: true,
  tournamentId: true,
  heroSeat: true,
  winnerSeat: true,
  dealtCards: true,
  board: true,
  boardFlop: true,
  boardTurn: true,
  boardRiver: true,
  totalPotCents: true,
  mainPotCents: true,
  evRealizedCents: true,
  evAllInAdjCents: true,
  evSamples: true,
  evUpdatedAt: true,
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

type HandRow = Prisma.HandGetPayload<{ select: typeof HAND_SELECT }>;

const toHandLike = (hand: HandRow): HandLike => ({
  id: hand.id,
  playedAt: hand.playedAt ?? null,
  heroSeat: hand.heroSeat ?? null,
  winnerSeat: hand.winnerSeat ?? null,
  dealtCards: hand.dealtCards ?? null,
  board: hand.board ?? null,
  boardFlop: hand.boardFlop ?? null,
  boardTurn: hand.boardTurn ?? null,
  boardRiver: hand.boardRiver ?? null,
  totalPotCents: hand.totalPotCents ?? null,
  mainPotCents: hand.mainPotCents ?? null,
  actions: hand.actions.map((a) => ({
    orderNo: a.orderNo,
    seat: a.seat === 0 ? null : a.seat,
    type: a.type,
    sizeCents: a.sizeCents ?? null,
    street: a.street,
    isAllIn: a.isAllIn,
  })),
  players: hand.players.map((p) => ({
    seat: p.seat,
    isHero: p.isHero ?? false,
    hole: p.hole ?? null,
    startingStackCents: p.startingStackCents ?? null,
  })),
});

export async function computeHandEv(handId: string, options: EvOptions = {}): Promise<HandEv> {
  const { collectTimings: _collectTimings, ...baseOptions } = options;
  const hand = await prisma.hand.findUnique({
    where: { id: handId },
    select: HAND_SELECT,
  });
  if (!hand) throw new Error('hand_not_found');

  const requiredSamples = normalizeSamples(baseOptions.samples != null ? Number(baseOptions.samples) : undefined);

  if (
    hand.evRealizedCents != null &&
    hand.evAllInAdjCents != null &&
    (hand.evSamples ?? 0) >= requiredSamples
  ) {
    return {
      handId,
      playedAt: hand.playedAt,
      realizedChangeCents: hand.evRealizedCents,
      allInAdjustedChangeCents: hand.evAllInAdjCents,
    };
  }

  const ev = computeHandEvForRecord(toHandLike(hand), { ...baseOptions, samples: requiredSamples });
  const nextSamples =
    ev.allInAdjustedChangeCents != null
      ? requiredSamples
      : hand.evSamples != null
        ? hand.evSamples
        : 0;

  await prisma.hand.update({
    where: { id: handId },
    data: {
      evRealizedCents: ev.realizedChangeCents,
      evAllInAdjCents: ev.allInAdjustedChangeCents,
      evSamples: nextSamples,
      evUpdatedAt: new Date(),
    },
  });

  return {
    handId,
    playedAt: hand.playedAt,
    realizedChangeCents: ev.realizedChangeCents,
    allInAdjustedChangeCents: ev.allInAdjustedChangeCents,
  };
}

export async function getEvCurve(userId: string, limit?: number, options: EvOptions = {}) {
  const totalStart = performance.now();
  const { collectTimings = false, ...baseOptions } = options;
  const queryStart = performance.now();
  let hands = await prisma.hand.findMany({
    where: {
      tournament: { userId },
      ...(baseOptions.dateFrom || baseOptions.dateTo
        ? {
            playedAt: {
              ...(baseOptions.dateFrom ? { gte: baseOptions.dateFrom } : {}),
              ...(baseOptions.dateTo ? { lte: baseOptions.dateTo } : {}),
            },
          }
        : {}),
    },
    orderBy: [
      { playedAt: 'asc' },
      { handNo: 'asc' },
      { createdAt: 'asc' },
    ],
    take: limit != null && limit > 0 ? limit : undefined,
    select: HAND_SELECT,
  });
  // Optional filter by time-of-day across all dates
  if (baseOptions.hoursFrom && baseOptions.hoursTo) {
    const parseHhMm = (s: string) => {
      const [hh, mm] = s.split(":").map((v) => parseInt(v, 10));
      return (Math.max(0, Math.min(23, hh || 0)) * 60) + (Math.max(0, Math.min(59, mm || 0)));
    };
    const fromMin = parseHhMm(baseOptions.hoursFrom);
    const toMin = parseHhMm(baseOptions.hoursTo);
    const inRange = (d: Date) => {
      const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      // Use half-open intervals to avoid overlaps across complementary ranges
      if (fromMin <= toMin) return minutes >= fromMin && minutes < toMin; // [from, to)
      // wrap-around: [from, 24h) U [0, to)
      return minutes >= fromMin || minutes < toMin;
    };
    hands = hands.filter((h) => (h.playedAt ? inRange(h.playedAt) : false));
  }
  const queryMs = performance.now() - queryStart;

  // Dynamic sampling policy based on dataset size unless explicitly overridden
  let targetSamples: number;
  if (baseOptions.samples != null && Number.isFinite(Number(baseOptions.samples))) {
    targetSamples = normalizeSamples(Number(baseOptions.samples));
  } else {
    const n = hands.length;
    if (n >= 10000) targetSamples = 50;
    else if (n >= 3000) targetSamples = 100;
    else targetSamples = 250;
  }
  const quickSamples = targetSamples;

  const computeStart = performance.now();
  let cumActual = 0;
  let cumAdj = 0;
  const tournamentIds = new Set<string>();
  const perHandDurations: Array<{ handId: string; durationMs: number }> = [];
  const points: Array<{
    handId: string;
    handNo: string | null;
    playedAt: Date | null;
    cumActual: number;
    cumAdj: number;
  }> = [];

  const quickUpdates: Array<{ id: string; data: Prisma.HandUpdateInput }> = [];

  for (const hand of hands) {
    if (hand.tournamentId) tournamentIds.add(hand.tournamentId);

    let realized = hand.evRealizedCents;
    let adjusted = hand.evAllInAdjCents;
    let usedSamples = hand.evSamples ?? 0;

    const needsQuick =
      realized == null || (usedSamples < quickSamples && hand.evAllInAdjCents != null);

    if (needsQuick) {
      const start = collectTimings ? performance.now() : 0;
      const ev = computeHandEvForRecord(toHandLike(hand), {
        ...baseOptions,
        samples: quickSamples,
      });
      if (collectTimings) {
        perHandDurations.push({
          handId: hand.handNo ?? hand.id,
          durationMs: performance.now() - start,
        });
      }
      const nextRealized = ev.realizedChangeCents ?? realized ?? null;
      const nextAdjusted = ev.allInAdjustedChangeCents ?? adjusted ?? null;
      const nextSamples = ev.allInAdjustedChangeCents != null ? Math.max(usedSamples, quickSamples) : usedSamples;
      const timestamp = new Date();
      realized = nextRealized;
      adjusted = nextAdjusted;
      usedSamples = nextSamples;
      hand.evRealizedCents = nextRealized;
      hand.evAllInAdjCents = nextAdjusted;
      hand.evSamples = nextSamples;
      hand.evUpdatedAt = timestamp;
      quickUpdates.push({
        id: hand.id,
        data: {
          evRealizedCents: nextRealized,
          evAllInAdjCents: nextAdjusted,
          evSamples: nextSamples,
          evUpdatedAt: timestamp,
        },
      });
    } else if (collectTimings) {
      perHandDurations.push({
        handId: hand.handNo ?? hand.id,
        durationMs: 0,
      });
    }

    const deltaActual = realized ?? 0;
    const deltaAdj = adjusted != null ? adjusted : deltaActual;
    cumActual += deltaActual;
    cumAdj += deltaAdj;
    points.push({
      handId: hand.handNo ?? hand.id,
      handNo: hand.handNo ?? null,
      playedAt: hand.playedAt,
      cumActual,
      cumAdj,
    });
  }

  const computeMs = performance.now() - computeStart;

  if (quickUpdates.length > 0) {
    const CHUNK = 25;
    for (let i = 0; i < quickUpdates.length; i += CHUNK) {
      const chunk = quickUpdates.slice(i, i + CHUNK);
      await prisma.$transaction(
        chunk.map((item) =>
          prisma.hand.update({
            where: { id: item.id },
            data: item.data,
          }),
        ),
      );
    }
  }

  const totalMs = performance.now() - totalStart;

  const sampledHands = hands
    .map((h) => (h.evAllInAdjCents != null && (h.evSamples ?? 0) > 0 ? h.evSamples ?? 0 : null))
    .filter((val): val is number => val != null && val > 0);
  const hasAllInData = sampledHands.length > 0;
  const samplesUsed = hasAllInData ? Math.min(...sampledHands) : null;
  const pendingSamples = null;

  let timings: EvTimings | undefined;
  if (collectTimings) {
    const topHandsByMs = [...perHandDurations]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10);
    const avgComputePerHandMs = hands.length > 0 ? computeMs / hands.length : 0;
    timings = { totalMs, queryMs, computeMs, avgComputePerHandMs, topHandsByMs };
    console.info('[getEvCurve] timings', {
      userId,
      limit: limit ?? null,
      numHands: hands.length,
      quickSamples,
      targetSamples,
      timings,
    });
  }
  // Progressive background precision upgrade disabled

  return {
    points,
    chipEvAdjTotal: cumAdj,
    numGames: tournamentIds.size,
    timings,
    samplesUsed,
    targetSamples,
    pendingSamples,
  };
}
