import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const session = await auth();
  let userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId && process.env.NODE_ENV !== 'production') {
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const items = await prisma.tournament.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: 200,
  });
  return NextResponse.json(items);
}


