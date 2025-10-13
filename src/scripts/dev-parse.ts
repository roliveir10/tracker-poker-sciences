import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { parseImport } from '@/server/parseImport';

async function main() {
	const email = 'dev@example.com';
	const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });

	const fileEnv = process.env.FILE;
	const defaultPath = path.resolve(__dirname, '../packages/parsers/betclic/fixtures/sample1.txt');
	const filePath = fileEnv && fileEnv.length > 0 ? fileEnv : defaultPath;
	const fileKey = filePath; // filesystem fallback supported

	const imp = await prisma.import.create({ data: { userId: user.id, status: 'queued', fileKey } });
	const result = await parseImport({ importId: imp.id, fileKey, userId: user.id });
	console.log('Parsed hands:', result.numHands, 'Import ID:', imp.id, 'File:', filePath);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});


