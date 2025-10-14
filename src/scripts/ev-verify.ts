import { prisma } from '@/lib/prisma';
import { computeHandEv } from '@/server/ev';
import { estimateMultiwayEquity } from '@/lib/poker/equity';

async function main() {
  const hands = await prisma.hand.findMany({
    orderBy: [{ playedAt: 'asc' }, { createdAt: 'asc' }],
    take: 200,
    select: { id: true, handNo: true, totalPotCents: true, mainPotCents: true },
  });
  for (const h of hands) {
    const ev = await computeHandEv(h.id, { seed: 123, samples: 50000 });
    // Also output equity if HU all-in present
    const hand = await prisma.hand.findUnique({ where: { id: h.id }, include: { actions: true, players: true } });
    let equity: number | null = null;
    if (hand) {
      const aiIdx = hand.actions.findIndex(a => a.isAllIn);
      if (aiIdx >= 0) {
        const heroSeat = hand.heroSeat ?? hand.players.find(p => p.isHero)?.seat ?? null;
        const heroHole = (hand.players.find(p => p.seat === heroSeat)?.hole || hand.dealtCards || '').split(' ').filter(Boolean) as [string, string] | [];
        const opp = hand.players.find(p => p.seat !== heroSeat && p.hole);
        if (heroHole.length === 2 && opp?.hole) {
          const villains = [opp.hole.split(' ') as [string, string]];
          const board: string[] = []; // HU examples are preflop all-in in this set
          const eq = estimateMultiwayEquity(heroHole, villains, board, 50000, () => Math.random());
          equity = Math.round(eq.winPct * 1000) / 1000;
        }
      }
    }
    console.log(
      JSON.stringify(
        {
          handId: h.handNo,
          realized: ev.realizedChangeCents,
          allInAdj: ev.allInAdjustedChangeCents,
          pot: h.totalPotCents ?? h.mainPotCents ?? null,
          equity,
        },
        null,
        0,
      ),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


