import { Hand as SolverHand } from 'pokersolver';

export type Card = string; // e.g., "As", "Kd"

export type EquityResult = {
  winPct: number;
  tiePct: number;
};

function buildSolverHand(cards: Card[]): any {
  return SolverHand.solve(cards.map((c) => c.toUpperCase()));
}

// Exhaustive board completion if remaining board cards <= 2; else Monte Carlo sampling
export function estimateMultiwayEquity(
  heroHole: [Card, Card],
  villains: Array<[Card, Card]>,
  board: Card[],
  samples = 10000,
  rng: () => number = Math.random,
): EquityResult {
  const used = new Set<string>([...heroHole, ...board, ...villains.flat()].map((c) => c.toUpperCase()));
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const suits = ['S','H','D','C'];
  const deck: string[] = [];
  for (const r of ranks) for (const s of suits) deck.push(r + s);
  const remaining = deck.filter((c) => !used.has(c));

  const need = 5 - board.length;
  const players = [[...heroHole], ...villains];

  function evaluate(boardCards: string[]): { heroBest: any; villainHands: any[] } {
    const heroBest = buildSolverHand([...(heroHole.map((c) => c.toUpperCase())), ...boardCards]);
    const villainHands = villains.map((vh) => buildSolverHand([...(vh.map((c) => c.toUpperCase())), ...boardCards]));
    return { heroBest, villainHands };
  }

  let win = 0;
  let tie = 0;

  // If the board is complete already
  if (need <= 0) {
    const { heroBest, villainHands } = evaluate(board.map((c) => c.toUpperCase()));
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


