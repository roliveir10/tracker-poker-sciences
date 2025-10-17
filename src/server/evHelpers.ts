import { estimateMultiwayEquity } from '../lib/poker/equity';

export type HandEv = {
  handId: string;
  playedAt: Date | null;
  realizedChangeCents: number | null;
  allInAdjustedChangeCents: number | null;
};

export type EvOptions = { samples?: number; seed?: number };

export type HandLike = {
  id: string;
  playedAt: Date | null;
  heroSeat: number | null;
  winnerSeat: number | null;
  dealtCards?: string | null;
  board?: string | null;
  boardFlop?: string | null;
  boardTurn?: string | null;
  totalPotCents?: number | null;
  mainPotCents?: number | null;
  actions: Array<{
    orderNo: number;
    seat: number | null;
    type: 'check' | 'fold' | 'call' | 'bet' | 'raise' | 'push';
    sizeCents: number | null;
    street: 'preflop' | 'flop' | 'turn' | 'river';
    isAllIn?: boolean | null;
  }>;
  players: Array<{ seat: number; isHero?: boolean | null; hole?: string | null }>;
};

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function computeHandEvForRecord(hand: HandLike, options: EvOptions = {}): HandEv {
  const heroPlayer = hand.players.find((p) => p.isHero) || null;
  const heroSeat = hand.heroSeat ?? heroPlayer?.seat ?? null;
  if (heroSeat == null) return { handId: hand.id, playedAt: hand.playedAt, realizedChangeCents: null, allInAdjustedChangeCents: null };

  const computeHeroContribution = (): number => {
    let contrib = 0;
    const investedPerSeat: Record<number, number> = {};
    let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
    for (const a of hand.actions.sort((a, b) => a.orderNo - b.orderNo)) {
      if (a.street !== currentStreet) {
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

  // Realized
  let realized: number | null = null;
  const allInIdx = hand.actions.findIndex((a) => !!a.isAllIn && a.seat === heroSeat);
  const totalsPerSeat = computeTotalContributionsPerSeat();
  const heroTotalContrib = totalsPerSeat[heroSeat] ?? computeHeroContribution();
  if (allInIdx >= 0) {
    const foldedAtAI: Set<number> = new Set();
    for (const a of hand.actions.slice(0, allInIdx + 1).sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.seat == null) continue;
      if (a.type === 'fold') foldedAtAI.add(a.seat);
    }
    const allSeats = Array.from(new Set(Object.keys(totalsPerSeat).map((s) => Number(s))));
    const aliveOpponents = allSeats.filter((s) => s !== heroSeat && !foldedAtAI.has(s));
    const deadMoney = allSeats.filter((s) => s !== heroSeat && foldedAtAI.has(s)).reduce((sum, s) => sum + (totalsPerSeat[s] ?? 0), 0);
    const oppMatchedSum = aliveOpponents.reduce((sum, s) => sum + Math.min(heroTotalContrib, totalsPerSeat[s] ?? 0), 0);
    const eligiblePot = heroTotalContrib + oppMatchedSum + deadMoney;
    if (eligiblePot > 0) {
      realized = hand.winnerSeat === heroSeat ? eligiblePot - heroTotalContrib : -heroTotalContrib;
    }
  } else {
    const potFromTotals = Object.values(totalsPerSeat).reduce((a, b) => a + b, 0);
    const pot = (hand.totalPotCents ?? hand.mainPotCents ?? null) ?? (potFromTotals > 0 ? potFromTotals : null);
    if (pot != null) {
      realized = hand.winnerSeat === heroSeat ? pot - heroTotalContrib : -heroTotalContrib;
    }
  }

  // All-in adjusted
  let adjusted: number | null = null;
  if (allInIdx >= 0) {
    const parseBoard = (s: string): string[] => s.replace(/[\[\]]/g, ' ').trim().split(/\s+|\|/).map((t) => t.trim()).filter(Boolean);
    const ai = hand.actions[allInIdx];
    const boardStr = (hand.board || '').replace(/[\[\]]/g, ' ').trim();
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

    const folded: Set<number> = new Set();
    for (const a of hand.actions.slice(0, allInIdx + 1).sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.seat != null && a.type === 'fold') folded.add(a.seat);
    }
    const allSeats = Array.from(new Set(Object.keys(totalsPerSeat).map((s) => Number(s))));
    const aliveOpponents = allSeats.filter((s) => s !== heroSeat && !folded.has(s));

    const heroHole = ((heroPlayer?.hole || hand.dealtCards || '')
      .replace(/[\[\]]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)) as [string, string] | [];
    // Consider only opponents with known hole cards
    const villainsHoles: Array<[string, string]> = aliveOpponents
      .map((s) => hand.players.find((p) => p.seat === s)?.hole || null)
      .filter((h): h is string => !!h)
      .map((h) => h.split(' ') as [string, string]);

    if (heroHole.length === 2 && villainsHoles.length >= 1) {
      const rng = options.seed != null ? makeSeededRng(options.seed) : Math.random;
      const samples = options.samples ?? 10000;
      const eq = estimateMultiwayEquity(heroHole as [string, string], villainsHoles, boardCards, samples, rng);
      const isHU = villainsHoles.length === 1;
      const effectiveEq = isHU ? (eq.winPct + 0.5 * eq.tiePct) : eq.winPct;
      const heroInvest = totalsPerSeat[heroSeat] ?? 0;
      const deadMoney = allSeats.filter((s) => s !== heroSeat && folded.has(s)).reduce((sum, s) => sum + (totalsPerSeat[s] ?? 0), 0);
      const oppMatchedSum = aliveOpponents.reduce((sum, s) => sum + Math.min(heroInvest, totalsPerSeat[s] ?? 0), 0);
      const eligiblePot = heroInvest + oppMatchedSum + deadMoney;
      adjusted = Math.round(effectiveEq * eligiblePot - heroInvest);
    }
  }

  return {
    handId: hand.id,
    playedAt: hand.playedAt,
    realizedChangeCents: realized,
    allInAdjustedChangeCents: adjusted,
  };
}


