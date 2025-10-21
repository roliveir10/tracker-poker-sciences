import { prisma } from '@/lib/prisma';
import { getObjectAsBuffer } from '@/lib/storage/s3';
import { parseBetclicText, type ParsedTournament } from '@/packages/parsers/betclic';
import { unzipSync, strFromU8 } from 'fflate';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { computeHandEvForRecord } from '@/server/evHelpers';

export type ParseImportTimings = {
  totalMs: number;
  fetchMs: number;
  unzipMs: number;
  parseMs: number;
  persistMs: number;
};

const IMPORT_EV_SAMPLES = 100;
const IMPORT_EV_SEED = 1337;

export type ParseImportResult = {
  numHands: number;
  timings: ParseImportTimings;
};

export async function parseImport({
  importId,
  fileKey,
  userId,
}: {
  importId: string;
  fileKey: string;
  userId: string;
}): Promise<ParseImportResult> {
  await prisma.import.update({ where: { id: importId }, data: { status: 'processing' } });

  try {
    const totalStart = performance.now();
    const fetchStart = performance.now();
    const buf = await getObjectAsBuffer(fileKey);
    const fetchMs = performance.now() - fetchStart;
    const isZip = fileKey.toLowerCase().endsWith('.zip') || (buf.length >= 4 && buf.slice(0, 4).toString('binary') === 'PK\x03\x04');

    const tournamentsToPersist: ParsedTournament[] = [];
    let unzipMs = 0;
    let parseMs = 0;
    if (isZip) {
      const unzipStart = performance.now();
      const entries = unzipSync(new Uint8Array(buf));
      unzipMs = performance.now() - unzipStart;
      const parseZipStart = performance.now();
      const aggregate: Map<string, ParsedTournament> = new Map();
      for (const [path, data] of Object.entries(entries)) {
        if (!path.toLowerCase().endsWith('.txt')) continue;
        const text = strFromU8(data);
        const res = parseBetclicText(text);
        for (const t of res.tournaments) {
          const key = t.gameId || 'unknown';
          const existing = aggregate.get(key);
          if (!existing) {
            aggregate.set(key, { ...t });
          } else {
            existing.startedAt = existing.startedAt && t.startedAt ? (existing.startedAt < t.startedAt ? existing.startedAt : t.startedAt) : (existing.startedAt ?? t.startedAt ?? null);
            if (t.buyInCents) existing.buyInCents = t.buyInCents;
            if (t.rakeCents) existing.rakeCents = t.rakeCents;
            if (t.prizePoolCents) existing.prizePoolCents = t.prizePoolCents;
            if (t.prizeMultiplier) existing.prizeMultiplier = t.prizeMultiplier;
            if (t.heroResultPosition != null) existing.heroResultPosition = t.heroResultPosition;
            if (t.heroPrizeCents != null) existing.heroPrizeCents = t.heroPrizeCents;
            existing.hands.push(...t.hands);
          }
        }
      }
      tournamentsToPersist.push(...aggregate.values());
      parseMs = performance.now() - parseZipStart;
    } else {
      const text = buf.toString('utf-8');
      const parseStart = performance.now();
      const parsed = parseBetclicText(text);
      parseMs = performance.now() - parseStart;
      tournamentsToPersist.push(...parsed.tournaments);
    }

    const persistStart = performance.now();
    for (const t of tournamentsToPersist) {
      const tournament = await prisma.tournament.upsert({
        where: { userId_gameId: { userId, gameId: t.gameId } },
        create: {
          userId,
          importId,
          room: 'betclic',
          gameId: t.gameId,
          startedAt: t.startedAt ?? new Date(),
          buyInCents: t.buyInCents,
          rakeCents: t.rakeCents,
          prizePoolCents: t.prizePoolCents,
          prizeMultiplier: t.prizeMultiplier,
          heroResultPosition: t.heroResultPosition ?? null,
          profitCents: t.profitCents ?? 0,
        },
        update: {
          importId,
          startedAt: t.startedAt ?? new Date(),
          buyInCents: t.buyInCents,
          rakeCents: t.rakeCents,
          prizePoolCents: t.prizePoolCents,
          prizeMultiplier: t.prizeMultiplier,
          heroResultPosition: t.heroResultPosition ?? null,
          profitCents: t.profitCents ?? 0,
        },
      });

      await prisma.hand.deleteMany({ where: { tournamentId: tournament.id } });

      const actionsData: Array<{ handId: string; street: string; seat: number; type: string; sizeCents: number | null; isAllIn?: boolean | null; orderNo: number }>
        = [];
      const playersData: Array<{ handId: string; seat: number; name?: string | null; hole: string | null; startingStackCents: number | null; isHero: boolean }>
        = [];
      const enhancedHandsData: Array<Record<string, unknown>> = [];

      for (const handData of t.hands) {
        const handId = randomUUID();
        const actions = (handData.actions ?? []).map((a) => ({
          orderNo: a.orderNo,
          seat: a.seat ?? null,
          type: a.type,
          sizeCents: a.sizeCents ?? null,
          street: a.street,
          isAllIn: a.isAllIn ?? false,
        }));
        const players = (handData.players ?? []).map((p) => ({
          seat: p.seat,
          isHero: p.isHero ?? false,
          hole: p.hole ?? null,
          startingStackCents: p.startingStackCents ?? null,
        }));
        const ev = computeHandEvForRecord(
          {
            id: handId,
            playedAt: handData.playedAt ?? null,
            heroSeat: handData.heroSeat ?? null,
            winnerSeat: handData.winnerSeat ?? null,
            dealtCards: handData.dealtCards ?? null,
            board: handData.board ?? null,
            boardFlop: handData.boardFlop ?? null,
            boardTurn: handData.boardTurn ?? null,
            boardRiver: handData.boardRiver ?? null,
            totalPotCents: handData.totalPotCents ?? null,
            mainPotCents: handData.mainPotCents ?? null,
            actions,
            players,
          },
          { samples: IMPORT_EV_SAMPLES, seed: IMPORT_EV_SEED },
        );
        const evSamples = ev.allInAdjustedChangeCents != null ? IMPORT_EV_SAMPLES : 0;
        const evUpdatedAt = evSamples > 0 ? new Date() : null;

        enhancedHandsData.push({
          id: handId,
          tournamentId: tournament.id,
          handNo: handData.handId,
          heroSeat: handData.heroSeat ?? null,
          sbCents: handData.sbCents ?? null,
          bbCents: handData.bbCents ?? null,
          dealtCards: handData.dealtCards ?? null,
          board: handData.board ?? null,
          boardFlop: handData.boardFlop ?? null,
          boardTurn: handData.boardTurn ?? null,
          boardRiver: handData.boardRiver ?? null,
          winnerSeat: handData.winnerSeat ?? null,
          playedAt: handData.playedAt ?? null,
          totalPotCents: handData.totalPotCents ?? null,
          mainPotCents: handData.mainPotCents ?? null,
          evRealizedCents: ev.realizedChangeCents,
          evAllInAdjCents: ev.allInAdjustedChangeCents,
          evSamples,
          evUpdatedAt,
        });

        for (const a of handData.actions ?? []) {
          actionsData.push({
            handId,
            street: a.street,
            seat: a.seat ?? 0,
            type: a.type,
            sizeCents: a.sizeCents ?? null,
            isAllIn: a.isAllIn,
            orderNo: a.orderNo,
          });
        }
        for (const p of handData.players ?? []) {
          playersData.push({
            handId,
            seat: p.seat,
            name: p.name,
            hole: p.hole ?? null,
            startingStackCents: p.startingStackCents ?? null,
            isHero: p.isHero ?? false,
          });
        }
      }

      if (enhancedHandsData.length > 0) {
        await prisma.hand.createMany({ data: enhancedHandsData });
      }

      const batchCreateMany = async <T extends Record<string, unknown>>(items: T[], create: (chunk: T[]) => Promise<unknown>) => {
        if (items.length === 0) return;
        const CHUNK_SIZE = 500;
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          const chunk = items.slice(i, i + CHUNK_SIZE);
          // eslint-disable-next-line no-await-in-loop
          await create(chunk);
        }
      };

      await batchCreateMany(actionsData, (chunk) => prisma.action.createMany({ data: chunk }));
      await batchCreateMany(playersData, (chunk) => prisma.handPlayer.createMany({ data: chunk, skipDuplicates: true }));
    }
    const persistMs = performance.now() - persistStart;

    const numHands = tournamentsToPersist.reduce((acc, t) => acc + t.hands.length, 0);
    await prisma.import.update({
      where: { id: importId },
      data: { status: 'done', numHands, completedAt: new Date(), error: null },
    });

    const totalMs = performance.now() - totalStart;
    const timings: ParseImportTimings = {
      totalMs,
      fetchMs,
      unzipMs,
      parseMs,
      persistMs,
    };
    console.info('[parseImport] timings', {
      importId,
      fileKey,
      numTournaments: tournamentsToPersist.length,
      numHands,
      ...timings,
    });
    return { numHands, timings };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[parseImport] failed', err);
    await prisma.import.update({
      where: { id: importId },
      data: { status: 'failed', error: message },
    });
    throw err;
  }
}
