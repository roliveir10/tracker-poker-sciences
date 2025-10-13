import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { publishParseJob } from '@/lib/qstash';
import { parseImport } from '@/server/parseImport';
import { rateLimit } from '@/lib/rateLimit';

const BodySchema = z.object({
  fileKey: z.string().min(1),
  originalName: z.string().optional(),
  size: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(req, 'imports');
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { fileKey, originalName, size } = parsed.data;

  const imp = await prisma.import.create({
    data: {
      userId,
      status: 'queued',
      fileKey,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
  const enqueue = await publishParseJob({
    baseUrl,
    importId: imp.id,
    body: { fileKey, userId, originalName, size },
  });

  if (!enqueue.queued) {
    await parseImport({ importId: imp.id, fileKey, userId: session.user.id });
  }

  return NextResponse.json({ id: imp.id, status: enqueue.queued ? 'queued' : 'done' });
}

export async function GET() {
  const session = await auth();
  let userId = session?.user?.id;
  if (!userId && process.env.NODE_ENV !== 'production') {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const items = await prisma.import.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(items);
}


