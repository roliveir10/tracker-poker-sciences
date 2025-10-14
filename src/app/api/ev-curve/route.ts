import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { getEvCurve, computeHandEv } from '@/server/ev';
import type { Hand, Action, HandPlayer } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { estimateMultiwayEquity } from '@/lib/poker/equity';

export async function GET(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id ?? null;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  if (!userId && allowDevFallback) {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const seedParam = searchParams.get('seed');
  const sampParam = searchParams.get('samp');
  const options = {
    seed: seedParam ? parseInt(seedParam, 10) : undefined,
    samples: sampParam ? parseInt(sampParam, 10) : undefined,
  };
  const data = await getEvCurve(userId, isFinite(limit) ? limit : 200, options);

  // Optional debug: return details for first 5 hands
  if (searchParams.get('debug') === '1') {
    const hands = await prisma.hand.findMany({
      where: { tournament: { userId } },
      orderBy: { playedAt: 'asc' },
      take: 5,
      include: { actions: true, players: true },
    });
    type DebugHand = Hand & { actions: Action[]; players: HandPlayer[]; mainPotCents: number | null };
    const details: Array<{ handNo: string | null; heroHole: string | null; deltaAdj: number; deltaActual: number }> = [];
    for (const h of hands as DebugHand[]) {
      const ev = await computeHandEv(h.id, { seed: seedParam ? parseInt(seedParam, 10) : undefined, samples: sampParam ? parseInt(sampParam, 10) : undefined });
      const heroSeat = h.heroSeat ?? h.players.find(p => p.isHero)?.seat ?? null;
      const heroHoleStr = (heroSeat != null ? (h.players.find(p => p.seat === heroSeat)?.hole || h.dealtCards || null) : null);
      const deltaActual = ev.realizedChangeCents ?? 0;
      const deltaAdj = ev.allInAdjustedChangeCents != null ? ev.allInAdjustedChangeCents : deltaActual;
      details.push({ handNo: h.handNo ?? null, heroHole: heroHoleStr, deltaAdj, deltaActual });
    }
    return NextResponse.json({ ...data, debug: details });
  }

  return NextResponse.json(data);
}


