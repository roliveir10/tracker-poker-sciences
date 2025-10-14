import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { getUserStats } from '@/server/stats';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const session = await auth();
  let userId = session?.user?.id;
  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  if (!userId && allowDevFallback) {
    // Dev fallback: use or create dev@example.com
    const user = await prisma.user.upsert({ where: { email: 'dev@example.com' }, update: {}, create: { email: 'dev@example.com' } });
    userId = user.id;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const stats = await getUserStats(userId);
  return NextResponse.json(stats);
}


