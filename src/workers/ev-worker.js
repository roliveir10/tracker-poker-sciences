/// <reference lib="webworker" />

import { estimateHeroPotEquity } from '../lib/poker/equity';

function makeSeededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function parseBoardTokens(input) {
  return input ? input.replace(/\[|\]/g, ' ').trim().split(/\s+|\|/).map((t) => t.trim()).filter(Boolean) : [];
}

const boardPickers = (hand) => {
  const river = parseBoardTokens(hand.boardRiver);
  const full = parseBoardTokens(hand.board);
  const turn = parseBoardTokens(hand.boardTurn);
  const flop = parseBoardTokens(hand.boardFlop);
  const sources = [river, full, turn, flop];
  const pick = (count) => {
    for (const src of sources) {
      if (src.length >= count) return src.slice(0, count);
    }
    const fallback = sources.reduce((best, cur) => (cur.length > best.length ? cur : best), []);
    return fallback.slice(0, count);
  };
  return {
    final: () => pick(5),
  };
};

function computeEvForHand(hand, samples, seed) {
  const heroPlayer = hand.players.find((p) => p.isHero) || null;
  const heroSeat = (hand.heroSeat ?? (heroPlayer ? heroPlayer.seat : null));
  if (heroSeat == null) return { realized: null, adjusted: null };

  const boards = boardPickers(hand);
  const heroHole = ((heroPlayer?.hole || hand.dealtCards || '').replace(/\[|\]/g, ' ').trim().split(/\s+/).filter(Boolean));
  const finalBoard = boards.final();

  const totalsPerSeat = {};
  for (const a of [...hand.actions].sort((x, y) => x.orderNo - y.orderNo)) {
    if (a.seat == null) continue;
    const prev = totalsPerSeat[a.seat] ?? 0;
    let inc = 0;
    if (a.type === 'call' || a.type === 'bet') inc = Math.max(0, a.sizeCents ?? 0);
    else if (a.type === 'raise' || a.type === 'push') {
      const to = Math.max(0, a.sizeCents ?? 0);
      inc = Math.max(0, to - prev);
    }
    if (inc > 0) totalsPerSeat[a.seat] = prev + inc;
  }
  const heroContribution = totalsPerSeat[heroSeat] ?? 0;

  let realized = null;
  if (heroHole.length === 2 && finalBoard.length === 5) {
    const showdownVillains = hand.players
      .filter((p) => p.seat != null && p.seat !== heroSeat && !!p.hole)
      .map((p) => {
        const seat = p.seat;
        const holeCards = p.hole.trim().split(/\s+/);
        const rawContribution = Math.max(0, totalsPerSeat[seat] ?? 0);
        const contribution = heroContribution > 0 ? Math.min(heroContribution, rawContribution) : 0;
        return { seat, hole: holeCards, contribution };
      })
      .filter((v) => v.contribution > 0);
    const showdownSeatSet = new Set(showdownVillains.map((v) => v.seat));
    const deadMoney = Object.entries(totalsPerSeat)
      .map(([seatStr, value]) => ({ seat: Number(seatStr), value: Math.max(0, value) }))
      .filter(({ seat }) => seat !== heroSeat && !showdownSeatSet.has(seat))
      .reduce((sum, { value }) => sum + (heroContribution > 0 ? Math.min(heroContribution, value) : 0), 0);
    const matchedVillains = showdownVillains.reduce((sum, v) => sum + v.contribution, 0);
    const heroEligiblePot = heroContribution + matchedVillains + deadMoney;
    if (heroEligiblePot > 0) {
      if (showdownVillains.length === 0) realized = heroEligiblePot - heroContribution;
      else {
        const rng = (seed != null) ? makeSeededRng(seed) : Math.random;
        const eq = estimateHeroPotEquity([heroHole[0], heroHole[1]], heroContribution, showdownVillains.map((v) => ({ hole: [v.hole[0], v.hole[1]], contribution: v.contribution })), finalBoard, deadMoney, samples, rng);
        realized = Math.round(eq.sharePct * heroEligiblePot - heroContribution);
      }
    }
  }
  const adjusted = realized;
  return { realized: realized ?? null, adjusted: adjusted ?? null };
}

self.onmessage = (evt) => {
  const started = performance.now();
  const { jobId, hands, samples, seed } = evt.data;
  const results = hands.map((h) => {
    const ev = computeEvForHand(h, samples, seed);
    return { id: h.id, realized: ev.realized, adjusted: ev.adjusted, samples };
  });
  const durationMs = performance.now() - started;
  const out = { jobId, results, durationMs };
  self.postMessage(out);
};


