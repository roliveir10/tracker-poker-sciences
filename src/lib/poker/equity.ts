import { Hand as SolverHand } from 'pokersolver';

export type Card = string; // e.g., "As", "Kd"

export type EquityResult = {
  winPct: number;
  tiePct: number;
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

// Exhaustive board completion if remaining board cards <= 2; else Monte Carlo sampling
export function estimateMultiwayEquity(
  heroHole: [Card, Card],
  villains: Array<[Card, Card]>,
  board: Card[],
  samples = 10000,
  rng: () => number = Math.random,
): EquityResult {
  const used = new Set<string>([...heroHole, ...board, ...villains.flat()].map((c) => canonicalize(c)));
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const suits = ['h','d','c','s'];
  const deck: string[] = [];
  for (const r of ranks) for (const s of suits) deck.push(r + s);
  const remaining = deck.filter((c) => !used.has(c));

  const need = 5 - board.length;
  function evaluate(boardCards: string[]): { heroBest: SolverHandResult; villainHands: SolverHandResult[] } {
    const heroCanon = heroHole.map((c) => canonicalize(c));
    const boardCanon = boardCards.map((c) => canonicalize(c));
    const heroBest = buildSolverHand([...heroCanon, ...boardCanon]);
    const villainHands = villains.map((villain) => {
      const vCanon = villain.map((c) => canonicalize(c));
      return buildSolverHand([...vCanon, ...boardCanon]);
    });
    return { heroBest, villainHands };
  }

  let win = 0;
  let tie = 0;

  // If the board is complete already
  if (need <= 0) {
    const { heroBest, villainHands } = evaluate(board.map((c) => canonicalize(c)));
    const all = [heroBest, ...villainHands];
    const winner = SolverHand.winners(all);
    if (winner.length === 1 && winner[0] === heroBest) win += 1;
    else if (winner.includes(heroBest)) tie += 1;
    return { winPct: win, tiePct: tie };
  }

  // If need <= 2, attempt exhaustive enumeration
  if (need <= 2) {
    if (need === 1) {
      for (let i = 0; i < remaining.length; i++) {
        const b = [...board.map((c) => c.toUpperCase()), remaining[i]];
        const { heroBest, villainHands } = evaluate(b);
        const winner = SolverHand.winners([heroBest, ...villainHands]);
        if (winner.length === 1 && winner[0] === heroBest) win++;
        else if (winner.includes(heroBest)) tie++;
      }
      const total = remaining.length;
      return { winPct: win / total, tiePct: tie / total };
    }
    // need === 2
    let total = 0;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const b = [...board.map((c) => c.toUpperCase()), remaining[i], remaining[j]];
        const { heroBest, villainHands } = evaluate(b);
        const winner = SolverHand.winners([heroBest, ...villainHands]);
        if (winner.length === 1 && winner[0] === heroBest) win++;
        else if (winner.includes(heroBest)) tie++;
        total++;
      }
    }
    return { winPct: win / total, tiePct: tie / total };
  }

  // Monte Carlo for need >= 3
  const maxSamples = Math.max(1, samples);
  for (let s = 0; s < maxSamples; s++) {
    // random sample without replacement
    for (let k = 0; k < need; k++) {
      const idx = Math.floor(rng() * (remaining.length - k));
      const tmp = remaining[idx];
      remaining[idx] = remaining[remaining.length - 1 - k];
      remaining[remaining.length - 1 - k] = tmp;
    }
    const drawn = remaining.slice(remaining.length - need);
    const b = [...board.map((c) => c.toUpperCase()), ...drawn];
    const { heroBest, villainHands } = evaluate(b);
    const winner = SolverHand.winners([heroBest, ...villainHands]);
    if (winner.length === 1 && winner[0] === heroBest) win++;
    else if (winner.includes(heroBest)) tie++;
  }
  return { winPct: win / maxSamples, tiePct: tie / maxSamples };
}


