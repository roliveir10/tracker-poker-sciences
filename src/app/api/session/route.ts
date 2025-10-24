import { NextResponse } from 'next/server';
import { auth } from '@/auth';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({ authenticated: true, user: { id: session.user.id, email: session.user.email, name: session.user.name } });
}


