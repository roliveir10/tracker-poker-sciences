import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createPresignedUploadUrl } from '@/lib/storage/s3';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/rateLimit';

const BodySchema = z.object({
	filename: z.string().min(1),
	contentType: z.string().default('text/plain'),
});

export async function POST(req: NextRequest) {
	const session = await auth();
	const userId = (session?.user as { id?: string } | undefined)?.id;
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
	const key = `users/${userId}/imports/${Date.now()}-${encodeURIComponent(filename)}`;
	const url = await createPresignedUploadUrl({ key, contentType });

	return NextResponse.json({ url, key });
}
