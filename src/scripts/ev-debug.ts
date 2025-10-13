import { prisma } from '@/lib/prisma';
import { getEvCurve } from '@/server/ev';

async function main() {
  const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
  const data = await getEvCurve(user.id, 50);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });


