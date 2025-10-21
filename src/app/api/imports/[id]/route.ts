import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import path from 'node:path';
import { unlink } from 'node:fs/promises';

export const runtime = 'nodejs';

const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
	const params = await context.params;
	const importId = params.id;

	const session = await auth();
	let userId = session?.user?.id;

	if (!userId && allowDevFallback) {
		const user = await prisma.user.upsert({
			where: { email: 'dev@example.com' },
			update: {},
			create: { email: 'dev@example.com' },
		});
		userId = user.id;
	}

	if (!userId) {
		return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
	}

	const imp = await prisma.import.findFirst({ where: { id: importId, userId } });
	if (!imp) {
		return NextResponse.json({ error: 'not_found' }, { status: 404 });
	}

	try {
		await prisma.tournament.deleteMany({ where: { importId, userId } });
		await prisma.import.delete({ where: { id: importId } });
	} catch (err) {
		console.error('Failed to delete import', importId, err);
		return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
	}

	if (imp.fileKey.startsWith('file://')) {
		const filePath = path.resolve(imp.fileKey.replace('file://', ''));
		try {
			await unlink(filePath);
		} catch (err: unknown) {
			if (!(err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT')) {
				console.warn('Failed to remove local file for import', importId, err);
			}
		}
	}

	return NextResponse.json({ ok: true });
}
