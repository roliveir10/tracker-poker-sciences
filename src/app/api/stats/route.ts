import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserStats } from '@/server/stats';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id;
  if (!userId && process.env.NODE_ENV !== 'production') {
    // Dev fallback: use or create dev@example.com
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const stats = await getUserStats(userId);
  return NextResponse.json(stats);
}


