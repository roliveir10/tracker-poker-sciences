import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id ?? null;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  if (!userId && allowDevFallback) {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { ids?: string[] } | null;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((v) => typeof v === 'string') : [];
  if (ids.length === 0) return NextResponse.json({ hands: [] });
  if (ids.length > 5000) return NextResponse.json({ error: 'too_many_ids' }, { status: 400 });

  const rows = await prisma.hand.findMany({
    where: { id: { in: ids }, tournament: { userId } },
    select: {
      id: true,
      playedAt: true,
      heroSeat: true,
      winnerSeat: true,
      evRealizedCents: true,
      evAllInAdjCents: true,
      dealtCards: true,
      board: true,
      boardFlop: true,
      boardTurn: true,
      boardRiver: true,
      totalPotCents: true,
      mainPotCents: true,
      actions: {
        select: { orderNo: true, seat: true, type: true, sizeCents: true, street: true, isAllIn: true },
      },
      players: {
        select: { seat: true, isHero: true, hole: true, startingStackCents: true },
      },
    },
  });
  // preserve original order of ids
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const hands = ids.map((id) => byId.get(id)).filter(Boolean);
  return NextResponse.json({ hands });
}


