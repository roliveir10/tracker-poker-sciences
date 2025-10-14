import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { getEvCurve, computeHandEv } from '@/server/ev';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  if (!userId && allowDevFallback) {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const data = await getEvCurve(userId, isFinite(limit) ? limit : 200);

  // Optional debug: return details for first 5 hands
  if (searchParams.get('debug') === '1') {
    const hands = await prisma.hand.findMany({
      where: { tournament: { userId } },
      orderBy: { playedAt: 'asc' },
      take: 5,
      include: { actions: true, players: true },
    });
    const details = [] as any[];
    for (const h of hands) {
      const ev = await computeHandEv(h.id);
      const heroSeat = h.heroSeat ?? h.players.find(p => p.isHero)?.seat ?? null;
      const contrib = h.actions.filter(a => a.seat === heroSeat && a.sizeCents != null).reduce((s, a) => s + (a.sizeCents || 0), 0);
      details.push({
        handId: h.id,
        playedAt: h.playedAt,
        heroSeat,
        totalPotCents: h.totalPotCents,
        mainPotCents: (h as any).mainPotCents ?? null,
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


