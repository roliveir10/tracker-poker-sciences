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
};

export async function getUserStats(userId: string): Promise<UserStats> {
  const [tournaments, hands] = await Promise.all([
    prisma.tournament.findMany({ where: { userId } }),
    prisma.hand.count({ where: { tournament: { userId } } }),
  ]);

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

  return {
    tournaments: tournamentsCount,
    hands,
    totalBuyInCents,
    totalRakeCents,
    totalProfitCents,
    roiPct,
    itmPct,
    multiplierHistogram,
  };
}



