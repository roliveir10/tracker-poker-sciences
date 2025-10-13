import { describe, it, expect } from 'vitest';
import { estimateMultiwayEquity } from './equity';

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
});


