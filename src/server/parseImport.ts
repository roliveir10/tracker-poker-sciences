import { prisma } from '@/lib/prisma';
import { getObjectAsString } from '@/lib/storage/s3';
import { parseBetclicText } from '@/packages/parsers/betclic';

export async function parseImport({
	importId,
	fileKey,
	userId,
}: {
	importId: string;
	fileKey: string;
	userId: string;
}): Promise<{ numHands: number }>{
	await prisma.import.update({ where: { id: importId }, data: { status: 'processing' } });

	const text = await getObjectAsString(fileKey);
	const parsed = parseBetclicText(text);

	for (const t of parsed.tournaments) {
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

		// Clear existing hands to avoid duplicates on re-parse (no transaction to keep operations short on Neon)
		await prisma.hand.deleteMany({ where: { tournamentId: tournament.id } });

		for (const h of t.hands) {
			const created = await prisma.hand.create({
				data: {
					tournamentId: tournament.id,
					handNo: h.handId,
					heroSeat: h.heroSeat ?? null,
					sbCents: h.sbCents ?? null,
					bbCents: h.bbCents ?? null,
					dealtCards: h.dealtCards ?? null,
					board: h.board ?? null,
					boardFlop: h.boardFlop ?? null,
					boardTurn: h.boardTurn ?? null,
					boardRiver: h.boardRiver ?? null,
					winnerSeat: h.winnerSeat ?? null,
					playedAt: h.playedAt ?? null,
					totalPotCents: h.totalPotCents ?? null,
					mainPotCents: h.mainPotCents ?? null,
				},
			});

			if (h.actions && h.actions.length > 0) {
				const actionsData = h.actions.map((a) => ({
					handId: created.id,
					street: a.street,
					seat: a.seat ?? 0,
					type: a.type,
					sizeCents: a.sizeCents ?? null,
					isAllIn: a.isAllIn,
					orderNo: a.orderNo,
				}));
				await prisma.action.createMany({ data: actionsData });
			}

			if (h.players && h.players.length > 0) {
				const playersData = h.players.map((p) => ({
					handId: created.id,
					seat: p.seat,
					name: p.name,
					hole: p.hole ?? null,
					startingStackCents: p.startingStackCents ?? null,
					isHero: p.isHero ?? false,
				}));
				await prisma.handPlayer.createMany({ data: playersData, skipDuplicates: true });
			}
		}
	}

	const numHands = parsed.tournaments.reduce((acc, t) => acc + t.hands.length, 0);
	await prisma.import.update({
		where: { id: importId },
		data: { status: 'done', numHands, completedAt: new Date() },
	});

	return { numHands };
}


