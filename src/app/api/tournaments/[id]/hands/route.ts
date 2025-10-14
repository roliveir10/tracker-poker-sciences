import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const t = await prisma.tournament.findUnique({ where: { id: params.id } });
  if (!t || t.userId !== session.user.id) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const items = await prisma.hand.findMany({ where: { tournamentId: t.id }, orderBy: { createdAt: 'asc' }, take: 500 });
  return NextResponse.json(items);
}



