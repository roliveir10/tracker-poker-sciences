import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { parseImport } from '@/server/parseImport';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const importId = params.id;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';

  let effectiveUserId = userId;
  if (!effectiveUserId && allowDevFallback) {
    const user = await prisma.user.upsert({
      where: { email: 'dev@example.com' },
      update: {},
      create: { email: 'dev@example.com' },
    });
    effectiveUserId = user.id;
  }

  if (!effectiveUserId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const imp = await prisma.import.findUnique({
    where: { id: importId },
  });
  if (!imp || imp.userId !== effectiveUserId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (imp.status !== 'queued' && imp.status !== 'processing') {
    return NextResponse.json({ ok: true, skipped: true, status: imp.status });
  }

  try {
    const result = await parseImport({ importId: imp.id, fileKey: imp.fileKey, userId: imp.userId });
    return NextResponse.json({ ok: true, status: 'done', numHands: result.numHands, timings: result.timings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.import.update({ where: { id: imp.id }, data: { status: 'failed', error: message } });
    return NextResponse.json({ error: 'parse_failed', message }, { status: 500 });
  }
}

