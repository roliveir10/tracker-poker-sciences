import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { getEvCurve, computeHandEv } from '@/server/ev';
import type { Hand, Action, HandPlayer } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';

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
    const details: Array<{
      handId: string;
      playedAt: Date | null;
      heroSeat: number | null;
      totalPotCents: number | null;
      mainPotCents: number | null;
      actionsCount: number;
      players: Array<{ seat: number; isHero: boolean; hole: string | null }>;
      contrib: number;
      ev: Awaited<ReturnType<typeof computeHandEv>>;
    }> = [];
    for (const h of hands as DebugHand[]) {
      const ev = await computeHandEv(h.id);
      const heroSeat = h.heroSeat ?? h.players.find(p => p.isHero)?.seat ?? null;
      const contrib = h.actions.filter(a => a.seat === heroSeat && a.sizeCents != null).reduce((s, a) => s + (a.sizeCents ?? 0), 0);
      details.push({
        handId: h.id,
        playedAt: h.playedAt,
        heroSeat,
        totalPotCents: h.totalPotCents,
        mainPotCents: h.mainPotCents ?? null,
        actionsCount: h.actions.length,
        players: h.players.map(p => ({ seat: p.seat, isHero: p.isHero, hole: p.hole })),
        contrib,
        ev,
      });
    }
    return NextResponse.json({ ...data, debug: details });
  }

  return NextResponse.json(data);
}


