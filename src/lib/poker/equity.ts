import { Hand as SolverHand } from 'pokersolver';

export type Card = string; // e.g., "As", "Kd"

export type EquityResult = {
  winPct: number;
  tiePct: number;
};

export type HeroPotEquityResult = {
  winPct: number;
  tiePct: number;
  sharePct: number;
};

type SolverHandResult = ReturnType<typeof SolverHand.solve>;

function canonicalize(card: Card): Card {
  // Ensure Rank uppercase and suit lowercase, e.g., 'Ah', 'Qc'
  if (!card || card.length < 2) return card;
  const rank = card[0].toUpperCase();
  const suit = card[1].toLowerCase();
  return `${rank}${suit}` as Card;
}

function buildSolverHand(cards: Card[]): SolverHandResult {
  return SolverHand.solve(cards.map((c) => canonicalize(c)));
}

type SimulationHandler = (payload: { heroHand: SolverHandResult; villainHands: SolverHandResult[]; board: Card[] }) => void;

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['h', 'd', 'c', 's'];

function iterateBoardCompletions(
  heroHole: [Card, Card],
  villains: Array<[Card, Card]>,
  board: Card[],
  samples: number,
  rng: () => number,
  handler: SimulationHandler,
): number {
  const heroCanon = heroHole.map((c) => canonicalize(c)) as [Card, Card];
  const villainsCanon = villains.map((villain) => villain.map((c) => canonicalize(c)) as [Card, Card]);
  const boardCanon = board.map((c) => canonicalize(c));
  const used = new Set<string>([...heroCanon, ...boardCanon, ...villainsCanon.flat()]);
  const deck: string[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push((r + s) as Card);
  const remaining = deck.filter((c) => !used.has(c));

  const need = Math.max(0, 5 - boardCanon.length);
  let iterations = 0;

  const invoke = (fullBoard: Card[]) => {
    const heroHand = buildSolverHand([...heroCanon, ...fullBoard]);
    const villainHands = villainsCanon.map((villain) => buildSolverHand([...villain, ...fullBoard]));
    handler({ heroHand, villainHands, board: fullBoard });
    iterations += 1;
  };

  if (need === 0) {
    invoke(boardCanon.slice(0, 5));
    return iterations;
  }

  if (need === 1) {
    for (let i = 0; i < remaining.length; i++) {
      invoke([...boardCanon, remaining[i]]);
    }
    return iterations;
  }

  if (need === 2) {
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        invoke([...boardCanon, remaining[i], remaining[j]]);
      }
    }
    return iterations;
  }

  const maxSamples = Math.max(1, samples);
  const drawDeck = [...remaining];
  for (let s = 0; s < maxSamples; s++) {
    for (let k = 0; k < need; k++) {
      const idx = Math.floor(rng() * (drawDeck.length - k));
      const swapIdx = drawDeck.length - 1 - k;
      const tmp = drawDeck[idx];
      drawDeck[idx] = drawDeck[swapIdx];
      drawDeck[swapIdx] = tmp;
    }
    const drawn = drawDeck.slice(drawDeck.length - need);
    invoke([...boardCanon, ...drawn]);
  }
  return iterations;
}

// Exhaustive board completion if remaining board cards <= 2; else Monte Carlo sampling
export function estimateMultiwayEquity(
  heroHole: [Card, Card],
  villains: Array<[Card, Card]>,
  board: Card[],
  samples = 1000,
  rng: () => number = Math.random,
): EquityResult {
  let win = 0;
  let tie = 0;

  const total = iterateBoardCompletions(heroHole, villains, board, samples, rng, ({ heroHand, villainHands }) => {
    const outcomes = [heroHand, ...villainHands];
    const winners = SolverHand.winners(outcomes);
    if (winners.length === 1 && winners[0] === heroHand) win += 1;
    else if (winners.includes(heroHand)) tie += 1;
  });

  if (total === 0) return { winPct: 0, tiePct: 0 };
  return { winPct: win / total, tiePct: tie / total };
}

type PotLayer = { amount: number; indices: number[] };

function buildPotLayers(contributions: number[]): PotLayer[] {
  const participants = contributions.map((contribution, idx) => ({ idx, contribution })).filter((p) => p.contribution > 0);
  if (!participants.some((p) => p.idx === 0)) return [];

  const sorted = [...participants].sort((a, b) => a.contribution - b.contribution);
  let prev = 0;
  let active = [...participants];
  const layers: PotLayer[] = [];

  for (const entry of sorted) {
    const cap = entry.contribution;
    if (cap <= prev) continue;
    const eligible = active.map((p) => p.idx);
    const layerAmount = (cap - prev) * eligible.length;
    if (layerAmount > 0) layers.push({ amount: layerAmount, indices: eligible });
    active = active.filter((p) => p.contribution > cap);
    prev = cap;
  }

  return layers;
}

const EPSILON = 1e-6;

export function estimateHeroPotEquity(
  heroHole: [Card, Card],
  heroContribution: number,
  villains: Array<{ hole: [Card, Card]; contribution: number }>,
  board: Card[],
  deadMoney = 0,
  samples = 1000,
  rng: () => number = Math.random,
): HeroPotEquityResult {
  if (heroContribution <= 0) return { winPct: 0, tiePct: 0, sharePct: 0 };

  const filteredVillains = villains.filter((v) => v.contribution > 0);
  if (filteredVillains.length === 0) {
    return { winPct: 1, tiePct: 0, sharePct: 1 };
  }

  const villainHoles = filteredVillains.map((v) => v.hole);
  const contributions = [heroContribution, ...filteredVillains.map((v) => v.contribution)];
  const layers = buildPotLayers(contributions);
  if (layers.length === 0) {
    const eq = estimateMultiwayEquity(heroHole, villainHoles, board, samples, rng);
    const participants = villainHoles.length + 1;
    const share = eq.winPct + (participants > 0 ? eq.tiePct / participants : 0);
    return { ...eq, sharePct: share };
  }

  const layersWithDeadMoney = layers.map((layer, idx) => (idx === 0 && deadMoney > 0 ? { ...layer, amount: layer.amount + deadMoney } : layer));
  const heroEligiblePot = layersWithDeadMoney
    .filter((layer) => layer.indices.includes(0))
    .reduce((sum, layer) => sum + layer.amount, 0);
  if (heroEligiblePot <= 0) return { winPct: 0, tiePct: 0, sharePct: 0 };

  let winCount = 0;
  let tieCount = 0;
  let shareAccum = 0;

  const total = iterateBoardCompletions(heroHole, villainHoles, board, samples, rng, ({ heroHand, villainHands }) => {
    const allHands = [heroHand, ...villainHands];
    let heroPayout = 0;

    for (const layer of layersWithDeadMoney) {
      if (!layer.indices.includes(0)) continue;
      const handsForPot = layer.indices.map((idx) => allHands[idx]);
      const winners = SolverHand.winners(handsForPot);
      if (winners.includes(allHands[0])) {
        heroPayout += layer.amount / winners.length;
      }
    }

    if (heroPayout >= heroEligiblePot - EPSILON) winCount += 1;
    else if (heroPayout > EPSILON) tieCount += 1;

    shareAccum += heroPayout / heroEligiblePot;
  });

  if (total === 0) return { winPct: 0, tiePct: 0, sharePct: 0 };
  return {
    winPct: winCount / total,
    tiePct: tieCount / total,
    sharePct: shareAccum / total,
  };
}
