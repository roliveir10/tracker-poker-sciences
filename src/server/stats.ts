import { prisma } from '@/lib/prisma';

export type UserStats = {
  tournaments: number;
  hands: number;
  totalBuyInCents: number;
  totalRakeCents: number;
  totalProfitCents: number;
  roiPct: number; // -100..+inf
  itmPct: number; // 0..100
  multiplierHistogram: Array<{ multiplier: number; count: number }>; // e.g., x2: 10, x3: 5
  chipEvPerGame: number;
};

export type GetUserStatsOptions = {
  dateFrom?: Date;
  dateTo?: Date;
  hoursFrom?: string;
  hoursTo?: string;
  buyIns?: number[];
  position?: 'hu' | '3max';
  huRoles?: Array<'sb' | 'bb'>;
  m3Roles?: Array<'bu' | 'sb' | 'bb'>;
  effMinBB?: number;
  effMaxBB?: number;
  phase?: 'preflop' | 'postflop';
};

type PlayerRow = {
  seat: number;
  isHero: boolean | null;
  startingStackCents: number | null;
};

type ActionRow = {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  seat: number | null;
  sizeCents: number | null;
  orderNo: number;
};

type HandForStats = {
  id: string;
  tournamentId: string | null;
  playedAt: Date | null;
  heroSeat: number | null;
  sbCents: number | null;
  bbCents: number | null;
  evRealizedCents: number | null;
  evAllInAdjCents: number | null;
  players: PlayerRow[];
  actions: ActionRow[];
};

export async function getUserStats(
  userId: string,
  options?: GetUserStatsOptions,
): Promise<UserStats> {
  const dateFilter = (from?: Date, to?: Date) =>
    from || to
      ? {
          gte: from,
          lte: to,
        }
      : undefined;

  let [tournaments, handsCount, cevHands] = await Promise.all([
    prisma.tournament.findMany({
      where: {
        userId,
        ...(Array.isArray(options?.buyIns) && options?.buyIns.length ? { buyInCents: { in: options!.buyIns! } } : {}),
        ...(options?.dateFrom || options?.dateTo
          ? { startedAt: dateFilter(options?.dateFrom, options?.dateTo) }
          : {}),
      },
    }),
    prisma.hand.count({
      where: {
        tournament: { userId, ...(Array.isArray(options?.buyIns) && options?.buyIns.length ? { buyInCents: { in: options!.buyIns! } } : {}) },
        ...(options?.dateFrom || options?.dateTo
          ? { playedAt: dateFilter(options?.dateFrom, options?.dateTo) }
          : {}),
      },
    }),
    prisma.hand.findMany({
      where: {
        tournament: { userId, ...(Array.isArray(options?.buyIns) && options?.buyIns.length ? { buyInCents: { in: options!.buyIns! } } : {}) },
        ...(options?.dateFrom || options?.dateTo
          ? { playedAt: dateFilter(options?.dateFrom, options?.dateTo) }
          : {}),
      },
      orderBy: [
        { playedAt: 'asc' },
        { handNo: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        sbCents: true,
        bbCents: true,
        id: true,
        evAllInAdjCents: true,
        evRealizedCents: true,
        playedAt: true,
        tournamentId: true,
        heroSeat: true,
        players: { select: { seat: true, isHero: true, startingStackCents: true } },
        actions: { select: { street: true, seat: true, orderNo: true, sizeCents: true } },
      },
    }),
  ]);

  // Hours-of-day filter (UTC) post-query
  if (options?.hoursFrom && options?.hoursTo) {
    const parseHhMm = (s: string) => {
      const [hh, mm] = s.split(":").map((v) => parseInt(v, 10));
      return (Math.max(0, Math.min(23, hh || 0)) * 60) + (Math.max(0, Math.min(59, mm || 0)));
    };
    const fromMin = parseHhMm(options.hoursFrom);
    const toMin = parseHhMm(options.hoursTo);
    const inRange = (d: Date) => {
      const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      // Use half-open intervals to prevent overlap: [from, to)
      if (fromMin <= toMin) return minutes >= fromMin && minutes < toMin;
      // Wrap: [from, 24h) U [0, to)
      return minutes >= fromMin || minutes < toMin;
    };
    // Filter hands by playedAt hour-of-day
    const filteredHands = cevHands.filter((h) => (h.playedAt ? inRange(h.playedAt) : false));
    cevHands = filteredHands;
    handsCount = filteredHands.length;
    // Filter tournaments by startedAt hour-of-day (to avoid double-counting across complementary ranges)
    tournaments = tournaments.filter((t) => (t.startedAt ? inRange(t.startedAt) : false));
  }

  // Phase filter (préflop/postflop)
  if (options?.phase === 'preflop') {
    const filteredHands = cevHands.filter((h) => !(h.actions || []).some((a) => a.street === 'flop' || a.street === 'turn' || a.street === 'river'));
    cevHands = filteredHands;
    handsCount = filteredHands.length;
  } else if (options?.phase === 'postflop') {
    const filteredHands = cevHands.filter((h) => (h.actions || []).some((a) => a.street === 'flop'));
    cevHands = filteredHands;
    handsCount = filteredHands.length;
  }

  const tournamentsCount = tournaments.length;
  const totalBuyInCents = tournaments.reduce((s, t) => s + t.buyInCents, 0);
  const totalRakeCents = tournaments.reduce((s, t) => s + t.rakeCents, 0);
  const totalProfitCents = tournaments.reduce((s, t) => s + t.profitCents, 0);

  const denom = totalBuyInCents + totalRakeCents;
  const roiPct = denom === 0 ? 0 : (totalProfitCents / denom) * 100;
  const itmCount = tournaments.filter((t) => t.heroResultPosition === 1).length;
  const itmPct = tournamentsCount === 0 ? 0 : (itmCount / tournamentsCount) * 100;

  const histMap = new Map<number, number>();
  for (const t of tournaments) {
    const key = t.prizeMultiplier;
    histMap.set(key, (histMap.get(key) ?? 0) + 1);
  }
  const multiplierHistogram = Array.from(histMap.entries())
    .map(([multiplier, count]) => ({ multiplier, count }))
    .sort((a, b) => a.multiplier - b.multiplier);

  // Apply effective stack filter first (independently of position)
  const applyEffFilter = (hands: HandForStats[]): HandForStats[] => {
    if (options?.effMinBB == null && options?.effMaxBB == null) return hands;
    const minBB = options.effMinBB != null ? Number(options.effMinBB) : -Infinity;
    const maxBB = options.effMaxBB != null ? Number(options.effMaxBB) : Infinity;
    return hands.filter((h) => {
      const heroSeat = h.players.find((p) => p.isHero)?.seat ?? h.heroSeat ?? null;
      const bb = h.bbCents ?? null;
      if (heroSeat == null || bb == null || bb <= 0) return false;
      const stacks = (h.players ?? []).map((p) => ({ seat: p.seat, stack: p.startingStackCents ?? 0 })).filter((p) => (p.stack ?? 0) > 0);
      const heroStart = stacks.find((p) => p.seat === heroSeat)?.stack ?? 0;
      const others = stacks.filter((p) => p.seat !== heroSeat).map((p) => p.stack);
      if (heroStart <= 0 || others.length === 0) return false;
      const maxOther = Math.max(...others);
      const effChips = others.length === 1 ? Math.min(heroStart, others[0]!) : Math.min(heroStart, maxOther);
      const effBB = effChips / bb;
      return effBB >= minBB && effBB <= maxBB;
    });
  };

  const baseHands = applyEffFilter(cevHands);

  // Position-aware CEV per game when requested
  let chipEvPerGame: number;
  let tournamentsOut: number | null = null;
  if (options?.position === 'hu' || options?.position === '3max') {
    const want = options.position === 'hu' ? 2 : 3;
    let filteredHands = baseHands.filter((h) => Array.isArray(h.players) ? (new Set(h.players.map((p) => p.seat)).size === want) : false);
    if (options.position === 'hu' && Array.isArray(options.huRoles) && options.huRoles.length > 0) {
      filteredHands = filteredHands.filter((h) => {
        const heroSeat = (h.players.find((p) => p.isHero)?.seat) ?? h.heroSeat ?? null;
        const pre = (h.actions ?? []).filter((a) => a.street === 'preflop' && a.seat != null).sort((a, b) => a.orderNo - b.orderNo);
        const sbSeat = h.sbCents != null ? (pre.find((a) => a.sizeCents === h.sbCents)?.seat ?? null) : null;
        if (heroSeat == null || sbSeat == null) return false;
        const heroIsSb = sbSeat === heroSeat;
        if (heroIsSb && options.huRoles!.includes('sb')) return true;
        if (!heroIsSb && options.huRoles!.includes('bb')) return true;
        return false;
      });
    }
    if (options.position === '3max' && Array.isArray(options.m3Roles) && options.m3Roles.length > 0) {
      filteredHands = filteredHands.filter((h) => {
        const heroSeat = (h.players.find((p) => p.isHero)?.seat) ?? h.heroSeat ?? null;
        if (heroSeat == null) return false;
        const pre = (h.actions ?? []).filter((a) => a.street === 'preflop' && a.seat != null).sort((a, b) => a.orderNo - b.orderNo);
        const sbSeat = h.sbCents != null ? (pre.find((a) => a.sizeCents === h.sbCents)?.seat ?? null) : null;
        const bbSeat = h.bbCents != null ? (pre.find((a) => a.sizeCents === h.bbCents && a.seat !== sbSeat)?.seat ?? null) : null;
        if (sbSeat == null || bbSeat == null) return false;
        const seats = new Set((h.players ?? []).map((p) => p.seat));
        const btnSeat = Array.from(seats).find((s) => s !== sbSeat && s !== bbSeat) ?? null;
        let role: 'bu' | 'sb' | 'bb' | null = null;
        if (heroSeat === btnSeat) role = 'bu';
        else if (heroSeat === sbSeat) role = 'sb';
        else if (heroSeat === bbSeat) role = 'bb';
        if (!role) return false;
        return options.m3Roles!.includes(role);
      });
    }
    const sumAdj = filteredHands.reduce((s, h) => s + (h.evAllInAdjCents ?? h.evRealizedCents ?? 0), 0);
    const tourneySet = new Set(filteredHands.map((h) => h.tournamentId).filter((id): id is string => Boolean(id)));
    const denom = tourneySet.size;
    chipEvPerGame = denom === 0 ? 0 : Math.round(sumAdj / denom);
    tournamentsOut = denom;
  } else {
    // Peak cumulative adjusted EV divided by tournaments in the (optionally eff-filtered) set
    let cumulativeAdj = 0;
    let peakAdj = 0;
    for (const hand of baseHands) {
      const delta = hand.evAllInAdjCents ?? hand.evRealizedCents ?? 0;
      cumulativeAdj += delta;
      if (cumulativeAdj > peakAdj) peakAdj = cumulativeAdj;
    }
    const tourneySet = new Set<string>();
    for (const h of baseHands) if (h.tournamentId) tourneySet.add(h.tournamentId);
    const denom = (options?.effMinBB != null || options?.effMaxBB != null || options?.phase != null) ? tourneySet.size : tournamentsCount;
    tournamentsOut = (options?.effMinBB != null || options?.effMaxBB != null || options?.phase != null) ? tourneySet.size : null;
    chipEvPerGame = denom === 0 ? 0 : Math.round(peakAdj / denom);
  }

  return {
    tournaments: tournamentsOut != null ? tournamentsOut : tournamentsCount,
    hands: handsCount,
    totalBuyInCents,
    totalRakeCents,
    totalProfitCents,
    roiPct,
    itmPct,
    multiplierHistogram,
    chipEvPerGame,
  };
}
