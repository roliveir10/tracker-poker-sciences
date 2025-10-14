import { prisma } from '@/lib/prisma';
import { estimateMultiwayEquity } from '@/lib/poker/equity';

export type HandEv = {
  handId: string;
  playedAt: Date | null;
  realizedChangeCents: number | null;
  allInAdjustedChangeCents: number | null;
};

export type EvOptions = { samples?: number; seed?: number };

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // LCG parameters (Numerical Recipes)
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export async function computeHandEv(handId: string, options: EvOptions = {}): Promise<HandEv> {
  const hand = await prisma.hand.findUnique({
    where: { id: handId },
    include: { actions: true, players: true, tournament: true },
  });
  if (!hand) throw new Error('hand_not_found');
  const heroPlayer = hand.players.find((p) => p.isHero) || null;
  const heroSeat = hand.heroSeat ?? heroPlayer?.seat ?? null;
  if (heroSeat == null) return { handId, playedAt: hand.playedAt, realizedChangeCents: null, allInAdjustedChangeCents: null };

  // Helper: compute hero contribution with correct handling of "raises to X" (incremental)
  const computeHeroContribution = (): number => {
    let contrib = 0;
    const investedPerSeat: Record<number, number> = {};
    let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
    for (const a of hand.actions.sort((a, b) => a.orderNo - b.orderNo)) {
      if (a.street !== currentStreet) {
        // Reset investments per new street
        for (const key of Object.keys(investedPerSeat)) delete investedPerSeat[Number(key)];
        currentStreet = a.street;
      }
      if (a.seat == null) continue;
      const prev = investedPerSeat[a.seat] ?? 0;
      let inc = 0;
      if (a.type === 'check' || a.type === 'fold') {
        // no change
      } else if (a.type === 'call' || a.type === 'bet') {
        inc = Math.max(0, a.sizeCents ?? 0);
        investedPerSeat[a.seat] = prev + inc;
      } else if (a.type === 'raise' || a.type === 'push') {
        const to = Math.max(0, a.sizeCents ?? 0);
        inc = Math.max(0, to - prev);
        investedPerSeat[a.seat] = Math.max(prev, to);
      }
      if (a.seat === heroSeat) contrib += inc;
    }
    return contrib;
  };

  // Realized change (rough): winner gets totalPot - own contribution. If unknown, skip.
  let realized: number | null = null;
  if (typeof hand.totalPotCents === 'number' || typeof hand.mainPotCents === 'number') {
    // Approx: if winnerSeat matches hero seat, realized ≈ +totalPot - heroContribution; else -heroContribution
    // Contribution approximée: somme des bets/calls/raises/push (capé par totalPot/numPlayers) — pour MVP, on somme ses mises.
    const contrib = computeHeroContribution();
    const pot = (hand.totalPotCents ?? 0) || (hand.mainPotCents ?? 0);
    if (pot > 0) realized = hand.winnerSeat === heroSeat ? pot - contrib : -contrib;
  }

  // All-in adjusted: find first all-in involving hero, compute equity vs opponents alive at that point using revealed cards and board at that time
  const allInIdx = hand.actions.findIndex((a) => a.isAllIn && a.seat === heroSeat);
  let adjusted: number | null = null;
  if (allInIdx >= 0) {
    const boardStr = (hand.board || '').replace(/[\[\]]/g, ' ').trim();
    const parseBoard = (s: string): string[] => s.replace(/[\[\]]/g, ' ').trim().split(/\s+|\|/).map((t) => t.trim()).filter(Boolean);
    const ai = hand.actions[allInIdx];
    let boardCards: string[] = [];
    if (ai.street === 'preflop') boardCards = [];
    else if (ai.street === 'flop') boardCards = (hand.boardFlop ? parseBoard(hand.boardFlop) : parseBoard(boardStr)).slice(0, 3);
    else if (ai.street === 'turn') {
      const turn = hand.boardTurn ? parseBoard(hand.boardTurn) : parseBoard(boardStr);
      boardCards = turn.slice(0, 4);
    } else if (ai.street === 'river') {
      const full = parseBoard(boardStr);
      boardCards = full.slice(0, 5);
    }

    // Compute matched contributions HU up to the all-in moment
    const investedPerSeat: Record<number, number> = {};
    let street: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
    const folded: Set<number> = new Set();
    for (const a of hand.actions.slice(0, allInIdx + 1).sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.street !== street) {
        // reset per-street invested trackers
        for (const key of Object.keys(investedPerSeat)) delete investedPerSeat[Number(key)];
        street = a.street;
      }
      if (a.seat == null) continue;
      if (a.type === 'fold') { folded.add(a.seat); continue; }
      const prev = investedPerSeat[a.seat] ?? 0;
      if (a.type === 'check') continue;
      if (a.type === 'call' || a.type === 'bet') {
        investedPerSeat[a.seat] = prev + Math.max(0, a.sizeCents ?? 0);
      } else if (a.type === 'raise' || a.type === 'push') {
        const to = Math.max(0, a.sizeCents ?? 0);
        investedPerSeat[a.seat] = Math.max(prev, to);
      }
    }
    // Determine opponent seat (highest invested not hero & not folded)
    const seatToInvested = Object.entries(investedPerSeat).map(([s, v]) => [Number(s), v as number]);
    const opponents = seatToInvested
      .filter(([s]) => s !== heroSeat && !folded.has(s))
      .sort((a, b) => (b[1] - a[1]));
    const oppSeat = opponents.length > 0 ? opponents[0][0] : null;

    const heroHole = ((heroPlayer?.hole || hand.dealtCards || '')
      .replace(/[\[\]]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)) as [string, string] | [];
    const oppHole = hand.players.find((p) => p.seat === oppSeat && p.hole)?.hole;
    if (heroHole.length === 2 && oppSeat && oppHole) {
      const villains: Array<[string, string]> = [oppHole.split(' ') as [string, string]];
      const rng = options.seed != null ? makeSeededRng(options.seed) : Math.random;
      const samples = options.samples ?? 10000;
      const eq = estimateMultiwayEquity(heroHole as [string, string], villains, boardCards, samples, rng);
      // Strict HU formula per spec: EV = (2*equity - 1) * matched
      const heroInvest = investedPerSeat[heroSeat] ?? 0;
      const oppInvest = investedPerSeat[oppSeat] ?? 0;
      const matched = Math.min(heroInvest, oppInvest);
      adjusted = Math.round((2 * eq.winPct - 1) * matched);
    }
  }

  return {
    handId,
    playedAt: hand.playedAt,
    realizedChangeCents: realized,
    allInAdjustedChangeCents: adjusted,
  };
}

export async function getEvCurve(userId: string, limit = 200, options: EvOptions = {}) {
  const hands = await prisma.hand.findMany({
    where: { tournament: { userId } },
    orderBy: { playedAt: 'asc' },
    take: limit,
    select: { id: true, handNo: true, playedAt: true },
  });
  let cumActual = 0;
  let cumAdj = 0;
  const points: Array<{ handId: string; handNo: string | null; playedAt: Date | null; cumActual: number; cumAdj: number }> = [];
  for (const h of hands) {
    const ev = await computeHandEv(h.id, options);
    const deltaActual = ev.realizedChangeCents ?? 0;
    const deltaAdj = ev.allInAdjustedChangeCents != null ? ev.allInAdjustedChangeCents : deltaActual;
    cumActual += deltaActual;
    cumAdj += deltaAdj;
    points.push({ handId: h.handNo ?? h.id, handNo: h.handNo ?? null, playedAt: ev.playedAt, cumActual, cumAdj });
  }
  return { points, chipEvAdjTotal: cumAdj };
}


