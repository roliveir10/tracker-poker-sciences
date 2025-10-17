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

  // Helper: compute total contributions per seat across the whole hand (handles "raise to X" per street)
  const computeTotalContributionsPerSeat = (): Record<number, number> => {
    const totals: Record<number, number> = {};
    const investedOnStreet: Record<number, number> = {};
    let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
    for (const a of hand.actions.sort((a, b) => a.orderNo - b.orderNo)) {
      if (a.street !== currentStreet) {
        for (const key of Object.keys(investedOnStreet)) delete investedOnStreet[Number(key)];
        currentStreet = a.street;
      }
      if (a.seat == null) continue;
      const prev = investedOnStreet[a.seat] ?? 0;
      let inc = 0;
      if (a.type === 'check' || a.type === 'fold') {
        // no contribution increment
      } else if (a.type === 'call' || a.type === 'bet') {
        inc = Math.max(0, a.sizeCents ?? 0);
        investedOnStreet[a.seat] = prev + inc;
      } else if (a.type === 'raise' || a.type === 'push') {
        const to = Math.max(0, a.sizeCents ?? 0);
        inc = Math.max(0, to - prev);
        investedOnStreet[a.seat] = Math.max(prev, to);
      }
      if (inc > 0) totals[a.seat] = (totals[a.seat] ?? 0) + inc;
    }
    return totals;
  };

  // Helper: compute contributions per seat up to a given action index (inclusive)
  const computeContributionsPerSeatUpTo = (endIdxInclusive: number): Record<number, number> => {
    const totals: Record<number, number> = {};
    const investedOnStreet: Record<number, number> = {};
    let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
    for (const a of hand.actions.slice(0, endIdxInclusive + 1).sort((a, b) => a.orderNo - b.orderNo)) {
      if (a.street !== currentStreet) {
        for (const key of Object.keys(investedOnStreet)) delete investedOnStreet[Number(key)];
        currentStreet = a.street;
      }
      if (a.seat == null) continue;
      const prev = investedOnStreet[a.seat] ?? 0;
      let inc = 0;
      if (a.type === 'check' || a.type === 'fold') {
      } else if (a.type === 'call' || a.type === 'bet') {
        inc = Math.max(0, a.sizeCents ?? 0);
        investedOnStreet[a.seat] = prev + inc;
      } else if (a.type === 'raise' || a.type === 'push') {
        const to = Math.max(0, a.sizeCents ?? 0);
        inc = Math.max(0, to - prev);
        investedOnStreet[a.seat] = Math.max(prev, to);
      }
      if (inc > 0) totals[a.seat] = (totals[a.seat] ?? 0) + inc;
    }
    return totals;
  };

  // Realized change
  let realized: number | null = null;
  const allInIdx = hand.actions.findIndex((a) => a.isAllIn && a.seat === heroSeat);
  const totalsPerSeatFinal = computeTotalContributionsPerSeat();
  const heroTotalContrib = totalsPerSeatFinal[heroSeat] ?? computeHeroContribution();
  if (allInIdx >= 0) {
    // Determine seats still alive at hero's all-in (not folded before that point)
    const foldedAtAI: Set<number> = new Set();
    let aiStreet: 'preflop' | 'flop' | 'turn' | 'river' = hand.actions[allInIdx].street;
    for (const a of hand.actions.slice(0, allInIdx + 1).sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.seat == null) continue;
      if (a.type === 'fold') foldedAtAI.add(a.seat);
      aiStreet = a.street;
    }
    const totalsAtAI = computeContributionsPerSeatUpTo(allInIdx);
    const heroInvestAI = totalsAtAI[heroSeat] ?? 0;
    const allSeats = Array.from(new Set(Object.keys(totalsAtAI).map((s) => Number(s))));
    const aliveOpponents = allSeats.filter((s) => s !== heroSeat && !foldedAtAI.has(s));
    const deadMoney = allSeats.filter((s) => s !== heroSeat && foldedAtAI.has(s)).reduce((sum, s) => sum + (totalsAtAI[s] ?? 0), 0);
    const oppMatchedSum = aliveOpponents.reduce((sum, s) => sum + Math.min(heroInvestAI, totalsAtAI[s] ?? 0), 0);
    const eligiblePot = heroInvestAI + oppMatchedSum + deadMoney;
    if (eligiblePot > 0) {
      realized = hand.winnerSeat === heroSeat ? eligiblePot - heroInvestAI : -heroInvestAI;
    }
  } else {
    // No all-in detected: compute realized from final pot fields or totals
    const potFromTotals = Object.values(totalsPerSeatFinal).reduce((a, b) => a + b, 0);
    const pot = (hand.totalPotCents ?? hand.mainPotCents ?? null) ?? (potFromTotals > 0 ? potFromTotals : null);
    if (pot != null) {
      realized = hand.winnerSeat === heroSeat ? pot - heroTotalContrib : -heroTotalContrib;
    }
  }

  // All-in adjusted: find first all-in involving hero, compute equity vs opponents alive at that point using revealed cards and board at that time
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

    // Determine opponents alive at AI and their final contributions
    const folded: Set<number> = new Set();
    for (const a of hand.actions.slice(0, allInIdx + 1).sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.seat != null && a.type === 'fold') folded.add(a.seat);
    }
    const totalsAtAI = computeContributionsPerSeatUpTo(allInIdx);
    const allSeats = Array.from(new Set(Object.keys(totalsAtAI).map((s) => Number(s))));
    const aliveOpponents = allSeats.filter((s) => s !== heroSeat && !folded.has(s));
    // For equity, keep HU behavior (pick the most involved opponent if multiple)
    const oppSeat = aliveOpponents
      .map((s) => [s, totalsAtAI[s] ?? 0] as [number, number])
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

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
      const effectiveEq = villains.length === 1 ? (eq.winPct + 0.5 * eq.tiePct) : eq.winPct;
      // Build eligible pot for hero at AI: hero + sum(min(hero, opp)) + dead money
      const heroInvestAI = totalsAtAI[heroSeat] ?? 0;
      const deadMoney = allSeats.filter((s) => s !== heroSeat && folded.has(s)).reduce((sum, s) => sum + (totalsAtAI[s] ?? 0), 0);
      const oppMatchedSum = aliveOpponents.reduce((sum, s) => sum + Math.min(heroInvestAI, totalsAtAI[s] ?? 0), 0);
      const eligiblePot = heroInvestAI + oppMatchedSum + deadMoney;
      adjusted = Math.round(effectiveEq * eligiblePot - heroInvestAI);
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
    orderBy: [
      { handNo: 'asc' }, // ULID-like Hand ID: lexicographically time-ordered
      { createdAt: 'asc' },
    ],
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


