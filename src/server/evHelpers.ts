import { estimateHeroPotEquity, type HeroPotEquityResult } from '../lib/poker/equity';

type HandAction = {
  orderNo: number;
  seat: number | null;
  type: 'check' | 'fold' | 'call' | 'bet' | 'raise' | 'push';
  sizeCents: number | null;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  isAllIn?: boolean | null;
};

function findHeroAllInOrderNo(actions: HandAction[], heroSeat: number): number | null {
  const sorted = [...actions].sort((a, b) => a.orderNo - b.orderNo);
  const pendingAllIns = new Set<number>();
  for (const act of sorted) {
    if (act.seat == null) continue;
    if (act.isAllIn) {
      if (act.seat === heroSeat) return act.orderNo;
      pendingAllIns.add(act.seat);
    }
    if (pendingAllIns.size > 0 && act.seat === heroSeat) {
      if (act.type === 'fold') return null;
      if (act.type === 'call' || act.type === 'raise' || act.type === 'push' || act.type === 'bet') {
        return act.orderNo;
      }
    }
    if (pendingAllIns.size > 0 && act.type === 'fold') {
      pendingAllIns.delete(act.seat);
    }
  }
  return null;
}

export type HandEv = {
  handId: string;
  playedAt: Date | null;
  realizedChangeCents: number | null;
  allInAdjustedChangeCents: number | null;
  equities?: {
    realized?: HeroPotEquityResult;
    adjusted?: HeroPotEquityResult;
  };
  allInContext?: {
    stage: 'preflop' | 'flop' | 'turn' | 'river';
    board: string[];
    participants: Array<{ seat: number; hole: [string, string] | null }>;
  };
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
  boardRiver?: string | null;
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
  players: Array<{ seat: number; isHero?: boolean | null; hole?: string | null; startingStackCents?: number | null }>;
};

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const parseBoardTokens = (input?: string | null): string[] =>
  input ? input.replace(/\[|\]/g, ' ').trim().split(/\s+|\|/).map((t) => t.trim()).filter(Boolean) : [];

const boardPickers = (hand: HandLike) => {
  const river = parseBoardTokens(hand.boardRiver);
  const full = parseBoardTokens(hand.board);
  const turn = parseBoardTokens(hand.boardTurn);
  const flop = parseBoardTokens(hand.boardFlop);
  const sources = [river, full, turn, flop];
  const pick = (count: number): string[] => {
    for (const src of sources) {
      if (src.length >= count) return src.slice(0, count);
    }
    const fallback = sources.reduce((best, cur) => (cur.length > best.length ? cur : best), [] as string[]);
    return fallback.slice(0, count);
  };
  return {
    flop: () => pick(3),
    turn: () => pick(4),
    river: () => pick(5),
    final: () => pick(5),
    byStreet: (street: 'preflop' | 'flop' | 'turn' | 'river'): string[] => {
      if (street === 'river') return pick(5);
      if (street === 'turn') return pick(4);
      if (street === 'flop') return pick(3);
      return [];
    },
  };
};

export function computeHandEvForRecord(hand: HandLike, options: EvOptions = {}): HandEv {
  const heroPlayer = hand.players.find((p) => p.isHero) || null;
  const heroSeat = hand.heroSeat ?? heroPlayer?.seat ?? null;
  if (heroSeat == null) {
    return { handId: hand.id, playedAt: hand.playedAt, realizedChangeCents: null, allInAdjustedChangeCents: null };
  }

  const boards = boardPickers(hand);
  const streetOrder: Record<'preflop' | 'flop' | 'turn' | 'river', number> = {
    preflop: 0,
    flop: 1,
    turn: 2,
    river: 3,
  };
  const heroHole = ((heroPlayer?.hole || hand.dealtCards || '')
    .replace(/\[|\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)) as [string, string] | [];

  let realizedEquity: HeroPotEquityResult | null = null;
  let adjustedEquity: HeroPotEquityResult | null = null;
  let allInContext: HandEv['allInContext'] | null = null;

  const computeHeroContribution = (): number => {
    let contrib = 0;
    const investedPerSeat: Record<number, number> = {};
    let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
    for (const a of [...hand.actions].sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.street !== currentStreet) {
        for (const key of Object.keys(investedPerSeat)) delete investedPerSeat[Number(key)];
        currentStreet = a.street;
      }
      if (a.seat == null) continue;
      const prev = investedPerSeat[a.seat] ?? 0;
      let inc = 0;
      if (a.type === 'call' || a.type === 'bet') {
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
    for (const a of [...hand.actions].sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.street !== currentStreet) {
        for (const key of Object.keys(investedOnStreet)) delete investedOnStreet[Number(key)];
        currentStreet = a.street;
      }
      if (a.seat == null) continue;
      const prev = investedOnStreet[a.seat] ?? 0;
      let inc = 0;
      if (a.type === 'call' || a.type === 'bet') {
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

  const computeContributionsPerSeatUpTo = (endIdxInclusive: number): Record<number, number> => {
    const totals: Record<number, number> = {};
    const investedOnStreet: Record<number, number> = {};
    let currentStreet: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
    for (const a of hand.actions.slice(0, endIdxInclusive + 1).sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.street !== currentStreet) {
        for (const key of Object.keys(investedOnStreet)) delete investedOnStreet[Number(key)];
        currentStreet = a.street;
      }
      if (a.seat == null) continue;
      const prev = investedOnStreet[a.seat] ?? 0;
      let inc = 0;
      if (a.type === 'call' || a.type === 'bet') {
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

  let realized: number | null = null;
  const heroAllInOrderNo = findHeroAllInOrderNo(hand.actions, heroSeat);
  const allInIdx = heroAllInOrderNo != null
    ? hand.actions.findIndex((a) => a.orderNo === heroAllInOrderNo && a.seat === heroSeat)
    : -1;
  const totalsPerSeat = computeTotalContributionsPerSeat();
  const heroTotalContrib = totalsPerSeat[heroSeat] ?? computeHeroContribution();
  const finalBoard = boards.final();
  const heroFolded = hand.actions.some((a) => a.seat === heroSeat && a.type === 'fold');

  let heroAllInValid = allInIdx >= 0;
  let totalsAtAI: Record<number, number> = {};
  let heroContributionAtAI = 0;
  let heroContributionMax = 0;
  let heroContributionCapForAdj = 0;
  let boardAtAI: string[] = [];
  let aiAction: (typeof hand.actions)[number] | null = null;
  let foldedBeforeAI: Set<number> = new Set();
  let foldedAfterAI: Set<number> = new Set();
  let allSeats: number[] = [];
  let opponentSeats: number[] = [];
  let aliveOpponents: number[] = [];
  let rawContributionAtAI: (seat: number) => number = () => 0;
  let eligibleContributionForSeat: (seat: number) => number = () => 0;
  let eligibleContributionForSeatAdj: (seat: number) => number = () => 0;
  let boardForAdjusted: string[] = [];
  let showdownSeatsAfterAI: number[] = [];
  let hasActionBeyondAiStreet = false;

  if (heroAllInValid) {
    aiAction = hand.actions[allInIdx];
    if (aiAction.street === 'preflop') boardAtAI = [];
    else if (aiAction.street === 'flop') boardAtAI = boards.flop();
    else if (aiAction.street === 'turn') boardAtAI = boards.turn();
    else boardAtAI = boards.river();

    totalsAtAI = computeContributionsPerSeatUpTo(allInIdx);
    heroContributionAtAI = totalsAtAI[heroSeat] ?? 0;

    const heroContributionAfterAI = heroTotalContrib - heroContributionAtAI;
    const heroActionsAfterAI = hand.actions.slice(allInIdx + 1);
    const heroActsAfterAI = heroActionsAfterAI.some((a) => a.seat === heroSeat);
    const heroFoldedAfter = heroActionsAfterAI.some((a) => a.seat === heroSeat && a.type === 'fold');
    const heroExplicitAllIn = aiAction.isAllIn === true;
    const heroEffectivelyAllIn = !heroActsAfterAI && !heroFoldedAfter && heroContributionAfterAI <= 0;
    if (!heroExplicitAllIn && !heroEffectivelyAllIn) {
      heroAllInValid = false;
    } else if (heroContributionAtAI <= 0) {
      heroAllInValid = false;
    }
  }

  if (heroAllInValid && aiAction != null) {
    foldedBeforeAI = new Set();
    for (const a of hand.actions.slice(0, allInIdx + 1).sort((x, y) => x.orderNo - y.orderNo)) {
      if (a.seat != null && a.type === 'fold') foldedBeforeAI.add(a.seat);
    }

    const seatSet = new Set<number>();
    for (const key of Object.keys(totalsAtAI)) seatSet.add(Number(key));
    for (const key of Object.keys(totalsPerSeat)) seatSet.add(Number(key));
    allSeats = Array.from(seatSet);
    opponentSeats = allSeats.filter((s) => s !== heroSeat);

    rawContributionAtAI = (seat: number) => {
      const before = totalsAtAI[seat] ?? 0;
      const after = totalsPerSeat[seat] ?? 0;
      return Math.max(0, Math.max(before, after));
    };

    heroContributionMax = Math.max(heroContributionAtAI, heroTotalContrib);
    const maxOpponentContribution = opponentSeats.reduce((max, seat) => Math.max(max, rawContributionAtAI(seat)), 0);
    heroContributionCapForAdj = Math.min(heroContributionAtAI, maxOpponentContribution);
    if (heroContributionCapForAdj <= 0) {
      heroAllInValid = false;
    } else {
      aliveOpponents = opponentSeats.filter((s) => !foldedBeforeAI.has(s));
      eligibleContributionForSeat = (seat: number): number => {
        const raw = rawContributionAtAI(seat);
        return heroContributionMax > 0 ? Math.min(heroContributionMax, raw) : 0;
      };
      eligibleContributionForSeatAdj = (seat: number): number => {
        const raw = rawContributionAtAI(seat);
        return heroContributionCapForAdj > 0 ? Math.min(heroContributionCapForAdj, raw) : 0;
      };
    }
  }

  if (heroAllInValid && aiAction != null) {
    const heroHoleTuple = heroHole.length === 2 ? (heroHole as [string, string]) : null;
    allInContext = {
      stage: aiAction.street,
      board: boardAtAI,
      participants: [
        { seat: heroSeat, hole: heroHoleTuple },
        ...aliveOpponents.map((seat) => {
          const player = hand.players.find((p) => p.seat === seat);
          const hole = player?.hole ? (player.hole.trim().split(/\s+/) as [string, string]) : null;
          return { seat, hole };
        }),
      ],
    };

    const postAllInActions = hand.actions.slice(allInIdx + 1).sort((x, y) => x.orderNo - y.orderNo);

    foldedAfterAI = new Set();
    for (const a of postAllInActions) {
      if (a.seat != null && a.type === 'fold') foldedAfterAI.add(a.seat);
    }

    showdownSeatsAfterAI = aliveOpponents.filter((seat) => !foldedAfterAI.has(seat));
    const showdownSeatSet = new Set(showdownSeatsAfterAI);
    const nonFinalOpponents = new Set(aliveOpponents.filter((seat) => !showdownSeatSet.has(seat)));
    const finalAllInStatus = new Map<number, boolean>();
    for (const seat of showdownSeatSet) finalAllInStatus.set(seat, false);

    boardForAdjusted = boards.byStreet(aiAction.street);
    let boardRank = streetOrder[aiAction.street];
    let resolutionLocked = false;
    let lastActionStreet: 'preflop' | 'flop' | 'turn' | 'river' = aiAction.street;

    for (const action of postAllInActions) {
      lastActionStreet = action.street;
      const candidateBoard = boards.byStreet(action.street);
      const candidateRank = streetOrder[action.street];
      if (streetOrder[action.street] > streetOrder[aiAction.street]) {
        hasActionBeyondAiStreet = true;
      }
      if (action.seat == null) continue;
      const seat = action.seat;

      if (nonFinalOpponents.has(seat)) {
        if (action.type === 'fold') {
          nonFinalOpponents.delete(seat);
          if (candidateRank >= boardRank) {
            boardForAdjusted = candidateBoard;
            boardRank = candidateRank;
          }
          resolutionLocked = true;
        }
        continue;
      }

      if (!showdownSeatSet.has(seat)) continue;

      if (action.isAllIn) {
        finalAllInStatus.set(seat, true);
      }

      const everyoneAllIn =
        showdownSeatSet.size > 0 &&
        Array.from(showdownSeatSet).every((s) => finalAllInStatus.get(s) === true);

      if (everyoneAllIn) {
        if (candidateRank >= boardRank) {
          boardForAdjusted = candidateBoard;
          boardRank = candidateRank;
        }
        resolutionLocked = true;
      }
    }

    if (!resolutionLocked) {
      if (hasActionBeyondAiStreet && showdownSeatSet.size >= 2) {
        const finalBoardForAdj = boards.final();
        if (finalBoardForAdj.length >= boardForAdjusted.length) {
          boardForAdjusted = finalBoardForAdj;
          boardRank = streetOrder.river;
        }
      } else if (nonFinalOpponents.size > 0) {
        const boardAtLastAction = boards.byStreet(lastActionStreet);
        if (boardAtLastAction.length >= boardForAdjusted.length) {
          boardForAdjusted = boardAtLastAction;
          boardRank = streetOrder[lastActionStreet];
        }
      }
    }

    let realizedHandled = false;
    if (heroHole.length === 2 && heroContributionMax > 0 && finalBoard.length === 5) {
      const showdownSeats = showdownSeatsAfterAI;
      const villainsWithInfo = showdownSeats.map((seat) => {
        const player = hand.players.find((p) => p.seat === seat);
        const hole = player?.hole;
        const contribution = eligibleContributionForSeat(seat);
        return hole ? { seat, hole: hole.trim().split(/\s+/) as [string, string], contribution } : null;
      });
      const allVillainsKnown = villainsWithInfo.every((v): v is { seat: number; hole: [string, string]; contribution: number } => v !== null);
      if (allVillainsKnown) {
        const showdownVillains = villainsWithInfo.filter((v) => v.contribution > 0);
        const showdownSeatSet = new Set(showdownSeats);
        const deadMoney = opponentSeats
          .filter((seat) => !showdownSeatSet.has(seat))
          .reduce((sum, seat) => sum + eligibleContributionForSeat(seat), 0);
        const villainContributionSum = showdownVillains.reduce((sum, v) => sum + v.contribution, 0);
        const totalVillainEligible = villainContributionSum + deadMoney;
        const heroEffectiveContribution = Math.min(heroContributionMax, totalVillainEligible);
        const heroEligiblePot = heroEffectiveContribution + totalVillainEligible;
        if (heroEligiblePot > 0 && heroEffectiveContribution > 0) {
          const rng = options.seed != null ? makeSeededRng(options.seed) : Math.random;
          const samples = Math.max(1, options.samples ?? 10000);
          const equity = estimateHeroPotEquity(
            heroHole as [string, string],
            heroEffectiveContribution,
            showdownVillains.map((v) => ({ hole: v.hole, contribution: v.contribution })),
            finalBoard,
            deadMoney,
            samples,
            rng,
          );
          realized = Math.round(equity.sharePct * heroEligiblePot - heroEffectiveContribution);
          realizedEquity = equity;
          realizedHandled = true;
        }
      }
    }

    if (!realizedHandled) {
      const matchingOpponents = aliveOpponents.filter((seat) => rawContributionAtAI(seat) >= heroContributionMax);
      if (matchingOpponents.length === 0) {
        const potFromTotals = Object.values(totalsPerSeat).reduce((a, b) => a + b, 0);
        const pot = (hand.totalPotCents ?? hand.mainPotCents ?? null) ?? (potFromTotals > 0 ? potFromTotals : null);
        if (pot != null) realized = hand.winnerSeat === heroSeat ? pot - heroTotalContrib : -heroTotalContrib;
      } else if (matchingOpponents.length === 1) {
        const oppSeat = matchingOpponents[0];
        const thirdParticipation = hand.actions
          .slice(allInIdx + 1)
          .some((a) => a.seat != null && a.seat !== heroSeat && a.seat !== oppSeat && a.type !== 'fold');
        if (!thirdParticipation) {
          const heroStart = hand.players.find((p) => p.seat === heroSeat)?.startingStackCents ?? null;
          const oppStart = hand.players.find((p) => p.seat === oppSeat)?.startingStackCents ?? null;
          const effStackByStart = heroStart != null && oppStart != null ? Math.min(heroStart, oppStart) : null;
          const effStackFallback = Math.min(heroContributionMax, rawContributionAtAI(oppSeat));
          const effectiveStack = effStackByStart ?? effStackFallback;
          const deadOthersAtAI = allSeats
            .filter((s) => s !== heroSeat && s !== oppSeat)
            .reduce((sum, seat) => sum + Math.min(heroContributionMax, rawContributionAtAI(seat)), 0);
          const computedMain = deadOthersAtAI + 2 * effectiveStack;
          const mainFromSummary = typeof hand.mainPotCents === 'number' ? hand.mainPotCents : null;
          const eligiblePotForHu = mainFromSummary ?? computedMain;
          if (eligiblePotForHu != null) {
            realized = hand.winnerSeat === heroSeat ? eligiblePotForHu - effectiveStack : -effectiveStack;
          }
        }
      } else {
        const potFromTotals = Object.values(totalsPerSeat).reduce((a, b) => a + b, 0);
        const pot = (hand.totalPotCents ?? hand.mainPotCents ?? null) ?? (potFromTotals > 0 ? potFromTotals : null);
        if (pot != null) realized = hand.winnerSeat === heroSeat ? pot - heroTotalContrib : -heroTotalContrib;
      }
    }
  } else {
    if (heroFolded) {
      realized = -heroTotalContrib;
    } else if (heroHole.length === 2 && finalBoard.length === 5) {
      const heroContribution = heroTotalContrib;
      const showdownVillains = hand.players
        .filter((p) => p.seat != null && p.seat !== heroSeat && !!p.hole)
        .map((p) => {
          const seat = p.seat as number;
          const holeCards = p.hole!.trim().split(/\s+/) as [string, string];
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
        if (showdownVillains.length === 0) {
          realized = heroEligiblePot - heroContribution;
        } else {
          const rng = options.seed != null ? makeSeededRng(options.seed) : Math.random;
          const samples = Math.max(1, options.samples ?? 10000);
          const equity = estimateHeroPotEquity(
            heroHole as [string, string],
            heroContribution,
            showdownVillains.map((v) => ({ hole: v.hole, contribution: v.contribution })),
            finalBoard,
            deadMoney,
            samples,
            rng,
          );
          realized = Math.round(equity.sharePct * heroEligiblePot - heroContribution);
          realizedEquity = equity;
        }
      }
    }

    if (realized == null) {
      const potFromTotals = Object.values(totalsPerSeat).reduce((a, b) => a + b, 0);
      const pot = (hand.totalPotCents ?? hand.mainPotCents ?? null) ?? (potFromTotals > 0 ? potFromTotals : null);
      if (pot != null) {
        realized = hand.winnerSeat === heroSeat ? pot - heroTotalContrib : -heroTotalContrib;
      }
    }
  }

  let adjusted: number | null = null;
  if (heroAllInValid && allInIdx >= 0) {
    const ai = hand.actions[allInIdx];
    const boardCards = boardForAdjusted.length > 0 ? boardForAdjusted : boards.byStreet(ai.street);
    const showdownSeats =
      showdownSeatsAfterAI.length > 0
        ? showdownSeatsAfterAI
        : aliveOpponents.filter((seat) => !foldedAfterAI.has(seat));
    const villainsWithInfo = showdownSeats.map((seat) => {
      const player = hand.players.find((p) => p.seat === seat);
      const hole = player?.hole;
      const contribution = eligibleContributionForSeatAdj(seat);
      return hole ? { seat, hole: hole.trim().split(/\s+/) as [string, string], contribution } : null;
    });
    const allVillainsKnown = villainsWithInfo.every((v): v is { seat: number; hole: [string, string]; contribution: number } => v !== null);
    if (heroHole.length === 2 && heroContributionCapForAdj > 0 && allVillainsKnown) {
      const showdownVillains = villainsWithInfo.filter((v) => v.contribution > 0);
      const showdownSeatSet = new Set(showdownSeats);
      const deadMoney = opponentSeats
        .filter((seat) => !showdownSeatSet.has(seat))
        .reduce((sum, seat) => sum + eligibleContributionForSeatAdj(seat), 0);
      const villainContributionSum = showdownVillains.reduce((sum, v) => sum + v.contribution, 0);
      const totalVillainEligible = villainContributionSum + deadMoney;
      const heroEffectiveContribution = Math.min(heroContributionCapForAdj, totalVillainEligible);
      const heroEligiblePot = heroEffectiveContribution + totalVillainEligible;
      if (heroEligiblePot > 0 && heroEffectiveContribution > 0) {
        const rng = options.seed != null ? makeSeededRng(options.seed) : Math.random;
        const samples = Math.max(1, options.samples ?? 10000);
        const equity = estimateHeroPotEquity(
          heroHole as [string, string],
          heroEffectiveContribution,
          showdownVillains.map((v) => ({ hole: v.hole, contribution: v.contribution })),
          boardCards,
          deadMoney,
          samples,
          rng,
        );
        adjusted = Math.round(equity.sharePct * heroEligiblePot - heroEffectiveContribution);
        adjustedEquity = equity;
      }
    }
  }

  if (realized != null && !Number.isFinite(realized)) realized = null;
  if (adjusted != null && !Number.isFinite(adjusted)) adjusted = null;

  return {
    handId: hand.id,
    playedAt: hand.playedAt,
    realizedChangeCents: realized,
    allInAdjustedChangeCents: adjusted,
    equities: realizedEquity || adjustedEquity ? {
      realized: realizedEquity ?? undefined,
      adjusted: adjustedEquity ?? undefined,
    } : undefined,
    allInContext: allInContext ?? undefined,
  };
}
