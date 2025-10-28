import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { publishParseJob } from '@/lib/qstash';
import { parseImport, type ParseImportTimings } from '@/server/parseImport';
import { rateLimit } from '@/lib/rateLimit';
import { getRemaining } from '@/lib/billing';
import { getObjectAsBuffer } from '@/lib/storage/s3';

const BodySchema = z.object({
  fileKey: z.string().min(1),
  originalName: z.string().optional(),
  size: z.number().int().min(0).optional(),
  contentType: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';

  if (!userId && allowDevFallback) {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(req, 'imports');
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  // Vérifie le quota restant avant d'accepter un nouvel import
  try {
    const quota = await getRemaining(userId);
    const remaining = Number.isFinite(quota.remaining) ? quota.remaining : Number.POSITIVE_INFINITY;
    if (remaining <= 0) {
      return NextResponse.json({ error: 'limit_reached', used: quota.used, limit: Number.isFinite(quota.limit) ? quota.limit : null, remaining: 0, window: quota.window, tier: quota.tier }, { status: 403 });
    }
  } catch {
    // Si la facturation est indisponible, par prudence on laisse passer l'import
  }

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { fileKey, originalName, size, contentType } = parsed.data;

  const imp = await prisma.import.create({
    data: {
      userId,
      status: 'queued',
      fileKey,
      originalName: originalName ?? null,
      contentType: contentType ?? null,
      size: typeof size === 'number' ? size : null,
    },
  });

  // Persist a copy of the uploaded file in DB when using local (non-S3) storage.
  if (fileKey.startsWith('file://') || fileKey.startsWith('/')) {
    try {
      const buffer = await getObjectAsBuffer(fileKey);
      const maxBytesEnv = Number(process.env.IMPORT_FILE_BLOB_MAX_BYTES ?? 0);
      const maxBytes = Number.isFinite(maxBytesEnv) && maxBytesEnv > 0 ? maxBytesEnv : 25 * 1024 * 1024;
      if (buffer.length <= maxBytes) {
        await prisma.import.update({
          where: { id: imp.id },
          data: {
            fileBlob: buffer,
            size: typeof size === 'number' ? size : buffer.length,
          },
        });
      } else {
        console.warn('[imports] uploaded file too large to persist in DB', {
          importId: imp.id,
          bytes: buffer.length,
          maxBytes,
        });
      }
    } catch (err: unknown) {
      console.warn('[imports] failed to persist local upload in DB', {
        importId: imp.id,
        fileKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const enqueue = await publishParseJob({
    importId: imp.id,
    body: { fileKey, userId, originalName, size },
  });

  let timings: ParseImportTimings | undefined;
  if (!enqueue.queued) {
    try {
      const result = await parseImport({ importId: imp.id, fileKey, userId });
      timings = result.timings;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: 'parse_failed', id: imp.id, message }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      id: imp.id,
      status: enqueue.queued ? 'queued' : 'done',
      timings,
      queueUrl: enqueue.queued ? enqueue.url : undefined,
      queueReason: enqueue.queued ? undefined : enqueue.reason,
    },
    { status: enqueue.queued ? 202 : 200 },
  );
}

export async function GET() {
  const session = await auth();
  let userId = session?.user?.id;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  if (!userId && allowDevFallback) {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const items = await prisma.import.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      numHands: true,
      numImported: true,
      numDuplicates: true,
      numInvalid: true,
      createdAt: true,
      completedAt: true,
      fileKey: true,
      originalName: true,
      size: true,
      contentType: true,
      error: true,
    },
  });
  return NextResponse.json(items);
}
