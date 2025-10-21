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

export async function getUserStats(
  userId: string,
  options?: { dateFrom?: Date; dateTo?: Date; hoursFrom?: string; hoursTo?: string },
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
        ...(options?.dateFrom || options?.dateTo
          ? { startedAt: dateFilter(options?.dateFrom, options?.dateTo) }
          : {}),
      },
    }),
    prisma.hand.count({
      where: {
        tournament: { userId },
        ...(options?.dateFrom || options?.dateTo
          ? { playedAt: dateFilter(options?.dateFrom, options?.dateTo) }
          : {}),
      },
    }),
    prisma.hand.findMany({
      where: {
        tournament: { userId },
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
        evAllInAdjCents: true,
        evRealizedCents: true,
        playedAt: true,
        tournamentId: true,
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
    tournaments = tournaments.filter((t) => {
      const startedAt = (t as any).startedAt as Date | null | undefined;
      return startedAt ? inRange(startedAt) : false;
    });
  }

  const tournamentsCount = tournaments.length;
  const totalBuyInCents = tournaments.reduce((s, t) => s + (t as any).buyInCents, 0);
  const totalRakeCents = tournaments.reduce((s, t) => s + (t as any).rakeCents, 0);
  const totalProfitCents = tournaments.reduce((s, t) => s + (t as any).profitCents, 0);

  const denom = totalBuyInCents + totalRakeCents;
  const roiPct = denom === 0 ? 0 : (totalProfitCents / denom) * 100;
  const itmCount = tournaments.filter((t) => (t as any).heroResultPosition === 1).length;
  const itmPct = tournamentsCount === 0 ? 0 : (itmCount / tournamentsCount) * 100;

  const histMap = new Map<number, number>();
  for (const t of tournaments) {
    const key = (t as any).prizeMultiplier as number;
    histMap.set(key, (histMap.get(key) ?? 0) + 1);
  }
  const multiplierHistogram = Array.from(histMap.entries())
    .map(([multiplier, count]) => ({ multiplier, count }))
    .sort((a, b) => a.multiplier - b.multiplier);

  let cumulativeAdj = 0;
  let peakAdj = 0;
  for (const hand of cevHands) {
    const delta = hand.evAllInAdjCents ?? hand.evRealizedCents ?? 0;
    cumulativeAdj += delta;
    if (cumulativeAdj > peakAdj) peakAdj = cumulativeAdj;
  }

  return {
    tournaments: tournamentsCount,
    hands: handsCount,
    totalBuyInCents,
    totalRakeCents,
    totalProfitCents,
    roiPct,
    itmPct,
    multiplierHistogram,
    chipEvPerGame: tournamentsCount === 0 ? 0 : Math.round(peakAdj / tournamentsCount),
  };
}
