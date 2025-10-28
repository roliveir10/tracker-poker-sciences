import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { getBankrollCurve } from '@/server/bankrollCurve';

const OUTPUT_PATH = path.resolve(process.cwd(), 'log', 'bankroll-curve-debug.json');

async function main() {
  const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
  const { points, debugEntries } = await getBankrollCurve(user.id, { debug: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    points,
    debugEntries,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`[bankroll-debug] wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
