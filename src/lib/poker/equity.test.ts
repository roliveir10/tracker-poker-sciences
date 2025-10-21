import { describe, it, expect } from 'vitest';
import { estimateHeroPotEquity, estimateMultiwayEquity } from './equity';

describe('estimateMultiwayEquity', () => {
  it('computes reasonable HU preflop equity (AKo vs QQ)', () => {
    const hero: [string, string] = ['As', 'Kd'];
    const vill: [string, string] = ['Qh', 'Qd'];
    // Simple LCG RNG to avoid degenerate constant draws
    let seed = 123456789;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const res = estimateMultiwayEquity(hero, [vill], [], 6000, rng);
    expect(res.winPct).toBeGreaterThan(0.38);
    expect(res.winPct).toBeLessThan(0.50);
  });

  it('computes reasonable 3-way preflop equity (AKo vs QQ vs 88)', () => {
    const hero: [string, string] = ['Ac', 'Kh'];
    const v1: [string, string] = ['Qs', 'Qd'];
    const v2: [string, string] = ['8s', '8d'];
    const res = estimateMultiwayEquity(hero, [v1, v2], [], 8000, Math.random);
    expect(res.winPct).toBeGreaterThan(0.25);
    expect(res.winPct).toBeLessThan(0.45);
  });

  it('computes full share when hero scoops multiway all-in', () => {
    const hero: [string, string] = ['8h', 'Th'];
    const villains = [
      { hole: ['2c', '5c'] as [string, string], contribution: 500 },
      { hole: ['Jd', 'Ac'] as [string, string], contribution: 500 },
    ];
    const board = ['5s', '9s', 'Qh', '9h', 'Kh'] as string[];
    const res = estimateHeroPotEquity(hero, 500, villains, board, 0, 1, Math.random);
    expect(res.sharePct).toBeCloseTo(1, 6);
    expect(res.winPct).toBeCloseTo(1, 6);
    expect(res.tiePct).toBeCloseTo(0, 6);
  });

  it('handles side-pot scenario with partial recovery', () => {
    const hero: [string, string] = ['Ah', 'Kd'];
    const villains = [
      { hole: ['2c', '5c'] as [string, string], contribution: 700 },
      { hole: ['Qh', 'Qd'] as [string, string], contribution: 300 },
    ];
    const board = ['Qc', 'Jd', '7s', '3h', '9c'] as string[];
    const res = estimateHeroPotEquity(hero, 500, villains, board, 0, 1, Math.random);
    expect(res.winPct).toBeCloseTo(0, 6);
    expect(res.tiePct).toBeCloseTo(1, 6);
    expect(res.sharePct).toBeCloseTo(400 / 1300, 6);
  });
});

