import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const DEV_UPLOAD_ROOT = process.env.DEV_UPLOAD_DIR || path.join(process.cwd(), '.local-storage', 'uploads');
const allowDevFallback = process.env.DEV_STORAGE === '1' || process.env.NODE_ENV !== 'production';

export const runtime = 'nodejs';

function isSubPath(parent: string, child: string) {
	const relative = path.relative(parent, child);
	return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function PUT(req: NextRequest) {
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

	const url = req.nextUrl;
	const filePathParam = url.searchParams.get('path');
	if (!filePathParam) {
		return NextResponse.json({ error: 'missing_path' }, { status: 400 });
	}

	const filePath = path.resolve(filePathParam);
	const expectedRoot = path.resolve(DEV_UPLOAD_ROOT);
	if (!isSubPath(expectedRoot, filePath)) {
		return NextResponse.json({ error: 'invalid_path' }, { status: 400 });
	}

	try {
		const arrayBuffer = await req.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, buffer);

		return new NextResponse(null, { status: 200 });
	} catch (err: unknown) {
		console.error('Local upload failed', err);
		return NextResponse.json({ error: 'write_failed' }, { status: 500 });
	}
}
