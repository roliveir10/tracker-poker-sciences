import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { prisma } from '@/lib/prisma';
import { parseImport } from '@/server/parseImport';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const importId = params.id;
  const rawBody = await req.text();

  // Verify QStash signature if keys are configured
  const sig = req.headers.get('Upstash-Signature');
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (sig && current && next) {
    const receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
    const isValid = await receiver.verify({ signature: sig, body: rawBody });
    if (!isValid) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const body = rawBody ? JSON.parse(rawBody) as { importId?: string; fileKey?: string; userId?: string } : {};
  if (!body || body.importId !== importId || !body.fileKey || !body.userId) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const imp = await prisma.import.findUnique({ where: { id: importId } });
  if (!imp) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    const result = await parseImport({ importId, fileKey: body.fileKey, userId: body.userId });
    return NextResponse.json({ ok: true, numHands: result.numHands });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.import.update({ where: { id: importId }, data: { status: 'failed', error: message } });
    return NextResponse.json({ error: 'parse_failed' }, { status: 500 });
  }
}



