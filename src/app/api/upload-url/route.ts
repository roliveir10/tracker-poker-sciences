import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createPresignedUploadUrl } from '@/lib/storage/s3';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const BodySchema = z.object({
	filename: z.string().min(1),
	contentType: z.string().default('text/plain'),
});

const DEV_UPLOAD_ROOT = process.env.DEV_UPLOAD_DIR || path.join(process.cwd(), '.local-storage', 'uploads');

const hasS3Config = Boolean(
	process.env.S3_REGION &&
	process.env.S3_BUCKET &&
	process.env.S3_ACCESS_KEY_ID &&
	process.env.S3_SECRET_ACCESS_KEY
);

const allowDevFallback = process.env.DEV_STORAGE === '1' || process.env.NODE_ENV !== 'production';

function sanitizeFilename(input: string): string {
	const base = path.basename(input);
	return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload.bin';
}

export async function POST(req: NextRequest) {
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

	const rl = await rateLimit(req, 'upload-url');
	if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

	const body = await req.json().catch(() => ({}));
	const parse = BodySchema.safeParse(body);
	if (!parse.success) {
		return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
	}

	const { filename, contentType } = parse.data;

	if (!hasS3Config) {
		if (!allowDevFallback) {
			return NextResponse.json({ error: 'storage_not_configured' }, { status: 500 });
		}
		const safeName = sanitizeFilename(filename);
		const uniqueName = `${Date.now()}-${randomUUID()}-${safeName}`;
			const filePath = path.join(DEV_UPLOAD_ROOT, userId, uniqueName);
			const key = `file://${filePath}`;
			const url = `/api/uploads/local?path=${encodeURIComponent(filePath)}`;
			return NextResponse.json({ url, key });
		}
	
		const key = `users/${userId}/imports/${Date.now()}-${encodeURIComponent(filename)}`;
		const url = await createPresignedUploadUrl({ key, contentType });
	
		return NextResponse.json({ url, key });
	}
