import { prisma } from '@/lib/prisma';
import { estimateMultiwayEquity } from '@/lib/poker/equity';

export type HandEv = {
  handId: string;
  playedAt: Date | null;
  realizedChangeCents: number | null;
  allInAdjustedChangeCents: number | null;
};

export async function computeHandEv(handId: string): Promise<HandEv> {
  const hand = await prisma.hand.findUnique({
    where: { id: handId },
    include: { actions: true, players: true, tournament: true },
  });
  if (!hand) throw new Error('hand_not_found');
  const heroPlayer = hand.players.find((p) => p.isHero) || null;
  const heroSeat = hand.heroSeat ?? heroPlayer?.seat ?? null;
  if (heroSeat == null) return { handId, playedAt: hand.playedAt, realizedChangeCents: null, allInAdjustedChangeCents: null };

  // Realized change (rough): winner gets totalPot - own contribution. If unknown, skip.
  let realized: number | null = null;
  if (typeof hand.totalPotCents === 'number' || typeof (hand as any).mainPotCents === 'number') {
    // Approx: if winnerSeat matches hero seat, realized ≈ +totalPot - heroContribution; else -heroContribution
    // Contribution approximée: somme des bets/calls/raises/push (capé par totalPot/numPlayers) — pour MVP, on somme ses mises.
    const heroActions = hand.actions.filter((a) => a.seat === heroSeat && a.sizeCents != null);
    const contrib = heroActions.reduce((s, a) => s + (a.sizeCents ?? 0), 0);
    const pot = (hand.totalPotCents ?? 0) || ((hand as any).mainPotCents ?? 0);
    if (pot > 0) realized = hand.winnerSeat === heroSeat ? pot - contrib : -contrib;
  }

  // All-in adjusted: find first all-in involving hero, compute equity vs opponents alive at that point using revealed cards and board at that time
  const allInIdx = hand.actions.findIndex((a) => a.isAllIn && a.seat === heroSeat);
  let adjusted: number | null = null;
  if (allInIdx >= 0) {
    const upTo = hand.actions.slice(0, allInIdx + 1);
    const boardStr = (hand.board || '').replace(/[\[\]]/g, ' ').trim();
    const boardCards = boardStr.split(/\s+|\|/).map(s => s.trim()).filter(Boolean);
    const heroHole = ((heroPlayer?.hole || hand.dealtCards || '')
      .replace(/[\[\]]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)) as [string, string] | [];
    const villainHoles: Array<[string, string]> = hand.players
      .filter((p) => p.seat !== heroSeat && p.hole)
      .map((p) => p.hole!.split(' ') as [string, string]);
    if (heroHole.length === 2 && villainHoles.length >= 1) {
      const eq = estimateMultiwayEquity(heroHole as [string, string], villainHoles, boardCards);
      const heroActions = hand.actions.filter((a) => a.seat === heroSeat && a.sizeCents != null);
      const contrib = heroActions.reduce((s, a) => s + (a.sizeCents ?? 0), 0);
      const pot = (hand.totalPotCents ?? 0) || ((hand as any).mainPotCents ?? 0) || contrib;
      const heroShare = eq.winPct + eq.tiePct / (villainHoles.length + 1);
      adjusted = Math.round(heroShare * pot - contrib);
    }
  }

  return {
    handId,
    playedAt: hand.playedAt,
    realizedChangeCents: realized,
    allInAdjustedChangeCents: adjusted,
  };
}

export async function getEvCurve(userId: string, limit = 200) {
  const hands = await prisma.hand.findMany({
    where: { tournament: { userId } },
    orderBy: { playedAt: 'asc' },
    take: limit,
    select: { id: true, playedAt: true },
  });
  let cumActual = 0;
  let cumAdj = 0;
  const points: Array<{ handId: string; playedAt: Date | null; cumActual: number; cumAdj: number }> = [];
  for (const h of hands) {
    const ev = await computeHandEv(h.id);
    if (ev.realizedChangeCents != null) cumActual += ev.realizedChangeCents;
    if (ev.allInAdjustedChangeCents != null) cumAdj += ev.allInAdjustedChangeCents;
    points.push({ handId: h.id, playedAt: ev.playedAt, cumActual, cumAdj });
  }
  return { points, chipEvAdjTotal: cumAdj };
}


