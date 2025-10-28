import { prisma } from '@/lib/prisma';

const STARTING_CHIPS_FALLBACK = 500;
const PLAYERS_PER_GAME = 3;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const parseHhMm = (value: string) => {
  const [hh, mm] = value.split(':').map((v) => parseInt(v, 10));
  const hours = Number.isFinite(hh) ? Math.min(Math.max(hh, 0), 23) : 0;
  const minutes = Number.isFinite(mm) ? Math.min(Math.max(mm, 0), 59) : 0;
  return (hours * 60) + minutes;
};

export type BankrollCurveFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  hoursFrom?: string;
  hoursTo?: string;
  buyIns?: number[];
  debug?: boolean;
};

export type BankrollCurvePoint = {
  tournamentId: string;
  startedAt: string | null;
  cumProfitCents: number;
  cumExpectedCents: number;
};

export type BankrollCurveDebugEntry = {
  tournamentId: string;
  startedAt: string | null;
  profitCents: number;
  cumProfitCents: number;
  cevChips: number;
  players: number;
  startChips: number;
  denomChips: number;
  prizePoolCents: number;
  buyInCents: number;
  winPctRaw: number;
  winPct: number;
  winPctWasClamped: boolean;
  expectedNetCents: number;
  cumExpectedCents: number;
};

export type BankrollCurveResult = {
  points: BankrollCurvePoint[];
  debugEntries: BankrollCurveDebugEntry[];
};

export async function getBankrollCurve(userId: string, filters: BankrollCurveFilters = {}): Promise<BankrollCurveResult> {
  const { dateFrom, dateTo, hoursFrom, hoursTo, buyIns, debug = false } = filters;

  const tournaments = await prisma.tournament.findMany({
    where: {
      userId,
      ...(Array.isArray(buyIns) && buyIns.length > 0 ? { buyInCents: { in: buyIns } } : {}),
      ...(dateFrom || dateTo
        ? {
            startedAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: 'asc' },
    select: { id: true, startedAt: true, profitCents: true, prizePoolCents: true, buyInCents: true, rakeCents: true },
  });

  let filtered = tournaments;
  if (hoursFrom && hoursTo) {
    const fromMin = parseHhMm(hoursFrom);
    const toMin = parseHhMm(hoursTo);
    const inRange = (date: Date): boolean => {
      const total = (date.getUTCHours() * 60) + date.getUTCMinutes();
      if (fromMin <= toMin) return total >= fromMin && total < toMin;
      return total >= fromMin || total < toMin;
    };
    filtered = tournaments.filter((t) => (t.startedAt ? inRange(t.startedAt) : false));
  }

  const filteredIds = filtered.map((t) => t.id);
  const cevByTournament = new Map<string, number>();
  const startByTournament = new Map<string, number>();

  if (filteredIds.length > 0) {
    const grouped = await prisma.hand.groupBy({
      by: ['tournamentId'],
      where: { tournamentId: { in: filteredIds } },
      _sum: { evAllInAdjCents: true, evRealizedCents: true },
    });

    type GroupedRow = {
      tournamentId: string;
      _sum: { evAllInAdjCents: number | null; evRealizedCents: number | null };
    };

    for (const row of grouped as GroupedRow[]) {
      const adj = row._sum.evAllInAdjCents;
      const realized = row._sum.evRealizedCents;
      const cev = (adj != null ? adj : realized) ?? 0;
      cevByTournament.set(row.tournamentId, Math.round(cev));
    }

    const hands = await prisma.hand.findMany({
      where: { tournamentId: { in: filteredIds } },
      orderBy: [
        { playedAt: 'asc' },
        { handNo: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        tournamentId: true,
        players: { select: { isHero: true, startingStackCents: true } },
      },
    });

    const seen = new Set<string>();
    for (const hand of hands) {
      const tid = hand.tournamentId as string;
      if (seen.has(tid)) continue;
      seen.add(tid);
      const heroStart = hand.players.find((p) => p.isHero)?.startingStackCents ?? null;
      if (heroStart && heroStart > 0) {
        startByTournament.set(tid, heroStart);
        continue;
      }
      const anyStart = hand.players.map((p) => p.startingStackCents ?? 0).filter((v) => v > 0);
      if (anyStart.length > 0) {
        startByTournament.set(tid, anyStart[0]!);
      }
    }
  }

  let cumProfit = 0;
  let cumExpected = 0;
  const points: BankrollCurvePoint[] = [];
  const debugEntries: BankrollCurveDebugEntry[] = [];

  for (const tournament of filtered) {
    const profitCents = tournament.profitCents ?? 0;
    cumProfit += profitCents;

    const cev = cevByTournament.get(tournament.id) ?? 0;
    const startChips = startByTournament.get(tournament.id) ?? STARTING_CHIPS_FALLBACK;
    const players = PLAYERS_PER_GAME;
    const denom = players * startChips;

    const winPctRaw = denom > 0 ? (startChips + cev) / denom : 0;
    const winPct = clamp01(winPctRaw);
    const prizePoolCents = tournament.prizePoolCents ?? 0;
    const buyInCents = tournament.buyInCents ?? 0;
    const expectedNetCents = (prizePoolCents * winPct) - buyInCents;
    cumExpected += expectedNetCents;

    points.push({
      tournamentId: tournament.id,
      startedAt: tournament.startedAt ? new Date(tournament.startedAt).toISOString() : null,
      cumProfitCents: cumProfit,
      cumExpectedCents: cumExpected,
    });

    if (debug) {
      debugEntries.push({
        tournamentId: tournament.id,
        startedAt: tournament.startedAt ? new Date(tournament.startedAt).toISOString() : null,
        profitCents,
        cumProfitCents: cumProfit,
        cevChips: cev,
        players,
        startChips,
        denomChips: denom,
        prizePoolCents,
        buyInCents,
        winPctRaw,
        winPct,
        winPctWasClamped: winPct !== winPctRaw,
        expectedNetCents,
        cumExpectedCents: cumExpected,
      });
    }
  }

  return { points, debugEntries };
}
