import { prisma } from '@/lib/prisma';

async function main() {
  // Order matters due to FKs (though onDelete cascades are set for most)
  const deletedActions = await prisma.action.deleteMany({});
  const deletedPlayers = await prisma.handPlayer.deleteMany({});
  const deletedHands = await prisma.hand.deleteMany({});
  const deletedTournaments = await prisma.tournament.deleteMany({});
  const deletedImports = await prisma.import.deleteMany({});

  console.log('Deleted:', {
    actions: deletedActions.count,
    players: deletedPlayers.count,
    hands: deletedHands.count,
    tournaments: deletedTournaments.count,
    imports: deletedImports.count,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


