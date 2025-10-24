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
  buyIns?: number[];  // liste de buy-ins (en cents) à inclure
  position?: 'hu' | '3max'; // heads-up (2 joueurs) ou 3 joueurs
  huRoles?: Array<'sb' | 'bb'>; // sous-catégories HU
  m3Roles?: Array<'bu' | 'sb' | 'bb'>; // sous-catégories 3-max
  effMinBB?: number; // stack effectif min (BB)
  effMaxBB?: number; // stack effectif max (BB)
  phase?: 'preflop' | 'postflop'; // filtre de phase: mains terminées préflop ou vues postflop
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
  sbCents: true,
  bbCents: true,
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
      tournament: {
        userId,
        ...(Array.isArray(baseOptions.buyIns) && baseOptions.buyIns.length > 0
          ? { buyInCents: { in: baseOptions.buyIns } }
          : {}),
      },
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
  // Filtre de phase (préflop/postflop)
  if (baseOptions.phase === 'preflop') {
    hands = hands.filter((h) => !h.actions.some((a) => a.street === 'flop' || a.street === 'turn' || a.street === 'river'));
  } else if (baseOptions.phase === 'postflop') {
    hands = hands.filter((h) => h.actions.some((a) => a.street === 'flop'));
  }
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
  // Optional effective stack filter in BB (based on hero starting stack / big blind)
  if (baseOptions.effMinBB != null || baseOptions.effMaxBB != null) {
    const minBB = baseOptions.effMinBB != null ? Number(baseOptions.effMinBB) : -Infinity;
    const maxBB = baseOptions.effMaxBB != null ? Number(baseOptions.effMaxBB) : Infinity;
    hands = hands.filter((h) => {
      const heroSeat = h.heroSeat ?? (h.players.find((p) => p.isHero)?.seat ?? null);
      const bb = h.bbCents ?? null;
      if (heroSeat == null || bb == null || bb <= 0) return false;
      const stacks = h.players.map((p) => ({ seat: p.seat, stack: p.startingStackCents ?? 0 })).filter((p) => (p.stack ?? 0) > 0);
      const heroStart = stacks.find((p) => p.seat === heroSeat)?.stack ?? 0;
      const others = stacks.filter((p) => p.seat !== heroSeat).map((p) => p.stack);
      if (heroStart <= 0 || others.length === 0) return false;
      const maxOther = Math.max(...others);
      const effChips = others.length === 1 ? Math.min(heroStart, others[0]!) : Math.min(heroStart, maxOther);
      const effBB = effChips / bb;
      return effBB >= minBB && effBB <= maxBB;
    });
  }
  // Optional position filter: HU (2 players) or 3-max (3 players)
  if (baseOptions.position === 'hu' || baseOptions.position === '3max') {
    const wantCount = baseOptions.position === 'hu' ? 2 : 3;
    hands = hands.filter((h) => {
      const count = Array.isArray(h.players) ? h.players.length : 0;
      return count === wantCount;
    });
    // HU sub-filter: hero SB/BB (prefer blind post detection over action order)
    if (baseOptions.position === 'hu' && Array.isArray(baseOptions.huRoles) && baseOptions.huRoles.length > 0) {
      hands = hands.filter((h) => {
        const heroSeat = h.heroSeat ?? (h.players.find((p) => p.isHero)?.seat ?? null);
        if (heroSeat == null) return false;
        const pre = h.actions.filter((a) => a.street === 'preflop' && a.seat != null);
        const sbPost = h.sbCents != null ? pre.find((a) => a.sizeCents === h.sbCents) ?? null : null;
        const sbSeat = sbPost?.seat ?? null;
        if (sbSeat == null) return false;
        const heroIsSb = sbSeat === heroSeat;
        if (heroIsSb && (baseOptions.huRoles ?? []).includes('sb')) return true;
        if (!heroIsSb && (baseOptions.huRoles ?? []).includes('bb')) return true;
        return false;
      });
    }
    // 3-max sub-filter: hero BU/SB/BB. Detect SB/BB via blind posts; BTN is the remaining seat
    if (baseOptions.position === '3max' && Array.isArray(baseOptions.m3Roles) && baseOptions.m3Roles.length > 0) {
      hands = hands.filter((h) => {
        const heroSeat = h.heroSeat ?? (h.players.find((p) => p.isHero)?.seat ?? null);
        if (heroSeat == null) return false;
        const preHu = h.actions.filter((a) => a.street === 'preflop' && a.seat != null).sort((a, b) => a.orderNo - b.orderNo);
        const sbSeat = h.sbCents != null
          ? (preHu.find((a) => a.sizeCents === h.sbCents)?.seat ?? null)
          : null;
        const pre3 = h.actions.filter((a) => a.street === 'preflop' && a.seat != null).sort((a, b) => a.orderNo - b.orderNo);
        const sbSeat3 = h.sbCents != null
          ? (pre3.find((a) => a.sizeCents === h.sbCents)?.seat ?? null)
          : null;
        const bbSeat3 = h.bbCents != null
          ? (pre3.find((a) => a.sizeCents === h.bbCents && a.seat !== sbSeat3)?.seat ?? null)
          : null;
        if (sbSeat3 == null || bbSeat3 == null) return false;
        const seats = new Set(h.players.map((p) => p.seat));
        const btnSeat = Array.from(seats).find((s) => s !== sbSeat3 && s !== bbSeat3) ?? null;
        let heroRole: 'bu' | 'sb' | 'bb' | null = null;
        if (heroSeat === btnSeat) heroRole = 'bu';
        else if (heroSeat === sbSeat3) heroRole = 'sb';
        else if (heroSeat === bbSeat3) heroRole = 'bb';
        if (!heroRole) return false;
        return (baseOptions.m3Roles ?? []).includes(heroRole);
      });
    }
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
  let cumShowdown = 0;
  let cumNoShowdown = 0;
  const tournamentIds = new Set<string>();
  const perHandDurations: Array<{ handId: string; durationMs: number }> = [];
  const points: Array<{
    handId: string;
    handNo: string | null;
    playedAt: Date | null;
    cumActual: number;
    cumAdj: number;
    cumShowdown?: number;
    cumNoShowdown?: number;
  }> = [];
  const TOURNAMENT_MODE_THRESHOLD = 7500;
  const useTournamentMode = hands.length > TOURNAMENT_MODE_THRESHOLD;
  const tournamentAgg = new Map<string, { earliest: Date | null; deltaActual: number; deltaAdj: number }>();

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

    // Classification simple proposée:
    // - si Hero fold => tout dans "sans showdown"
    // - sinon, s'il y a eu SHOWDOWN (détecté via un joueur non-hero qui "shows" donc a hole connu) => tout dans "avec showdown"
    // - sinon => tout dans "sans showdown"
    const heroSeat = hand.heroSeat ?? (hand.players.find((p) => p.isHero)?.seat ?? null);
    const heroFolded = heroSeat != null && hand.actions.some((a) => a.seat === heroSeat && a.type === 'fold');
    const nonHeroShowed = hand.players.some((p) => p.seat != null && p.seat !== heroSeat && !!p.hole);
    const isShowdown = !heroFolded && nonHeroShowed;

    if (useTournamentMode && hand.tournamentId) {
      const key = hand.tournamentId;
      const prev = tournamentAgg.get(key) ?? { earliest: hand.playedAt ?? null, deltaActual: 0, deltaAdj: 0 };
      const earliest = prev.earliest && hand.playedAt ? (prev.earliest < hand.playedAt ? prev.earliest : hand.playedAt) : (prev.earliest ?? hand.playedAt ?? null);
      tournamentAgg.set(key, { earliest, deltaActual: prev.deltaActual + deltaActual, deltaAdj: prev.deltaAdj + deltaAdj });
    } else {
      cumActual += deltaActual;
      cumAdj += deltaAdj;
      if (isShowdown) cumShowdown += deltaActual; else cumNoShowdown += deltaActual;
      points.push({
        handId: hand.handNo ?? hand.id,
        handNo: hand.handNo ?? null,
        playedAt: hand.playedAt,
        cumActual,
        cumAdj,
        cumShowdown,
        cumNoShowdown,
      });
    }
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

  let outPoints = points;
  if (useTournamentMode) {
    const entries = Array.from(tournamentAgg.entries()).map(([tid, v]) => ({ tournamentId: tid, earliest: v.earliest, deltaActual: v.deltaActual, deltaAdj: v.deltaAdj }));
    entries.sort((a, b) => {
      const ta = a.earliest ? a.earliest.getTime() : 0;
      const tb = b.earliest ? b.earliest.getTime() : 0;
      return ta - tb;
    });
    let cA = 0;
    let cE = 0;
    const agg: typeof points = [];
    for (const e of entries) {
      cA += e.deltaActual;
      cE += e.deltaAdj;
      agg.push({ handId: e.tournamentId, handNo: null, playedAt: e.earliest ?? null, cumActual: cA, cumAdj: cE });
    }
    outPoints = agg;
  }

  return {
    points: outPoints,
    chipEvAdjTotal: cumAdj,
    numGames: tournamentIds.size,
    timings,
    samplesUsed,
    targetSamples,
    pendingSamples,
  };
}
