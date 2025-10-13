import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getEvCurve, computeHandEv } from '@/server/ev';
import { prisma } from '@/lib/prisma';

type DebugHandDetail = {
  handId: string;
  playedAt: Date;
  heroSeat: number | null;
  totalPotCents: number | null;
  mainPotCents: number | null;
  actionsCount: number;
  players: Array<{ seat: number | null; isHero: boolean; hole: string | null }>;
  contrib: number;
  ev: number;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  // NextAuth's session.user may not be typed with 'id' by default; cast safely
  let userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId && process.env.NODE_ENV !== 'production') {
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
    const details: DebugHandDetail[] = [];
    for (const h of hands) {
      const ev = await computeHandEv(h.id);
      const heroSeat = h.heroSeat ?? h.players.find(p => p.isHero)?.seat ?? null;
      const contrib = h.actions.filter(a => a.seat === heroSeat && a.sizeCents != null).reduce((s, a) => s + (a.sizeCents || 0), 0);
      const mainPotCents = (h as Partial<{ mainPotCents: number | null }>).mainPotCents ?? null;
      details.push({
        handId: h.id,
        playedAt: h.playedAt,
        heroSeat,
        totalPotCents: (h as Partial<{ totalPotCents: number | null }>).totalPotCents ?? null,
        mainPotCents,
        actionsCount: h.actions.length,
        players: h.players.map(p => ({ seat: p.seat ?? null, isHero: Boolean(p.isHero), hole: (p as Partial<{ hole: string | null }>).hole ?? null })),
        contrib,
        ev,
      });
    }
    return NextResponse.json({ ...data, debug: details });
  }

  return NextResponse.json(data);
}


