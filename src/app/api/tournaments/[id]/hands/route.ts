import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t || t.userId !== userId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const items = await prisma.hand.findMany({ where: { tournamentId: t.id }, orderBy: { createdAt: 'asc' }, take: 500 });
  return NextResponse.json(items);
}



