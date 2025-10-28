import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getRemaining } from '@/lib/billing';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ authenticated: false }, { status: 200 });
  try {
    const info = await getRemaining(userId);
    return NextResponse.json({
      tier: info.tier,
      used: info.used,
      limit: Number.isFinite(info.limit) ? info.limit : null,
      remaining: Number.isFinite(info.remaining) ? info.remaining : null,
      window: { start: info.window.start.toISOString(), end: info.window.end.toISOString() },
    });
  } catch {
    return NextResponse.json({ error: 'billing_unavailable' }, { status: 503 });
  }
}




