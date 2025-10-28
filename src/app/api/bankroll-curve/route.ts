import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getBankrollCurve } from '@/server/bankrollCurve';

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
  const periodParam = searchParams.get('period');
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');
  const hoursFromParam = searchParams.get('hoursFrom');
  const hoursToParam = searchParams.get('hoursTo');
  const buyInsParam = searchParams.getAll('buyIns');
  const debugParam = searchParams.get('debug');
  // Bankroll curve only respects date/time and buy-ins filters

  let dateFrom: Date | undefined = dateFromParam ? new Date(dateFromParam) : undefined;
  let dateTo: Date | undefined = dateToParam ? new Date(dateToParam) : undefined;
  if (!dateFrom && !dateTo && periodParam) {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const dayOfWeek = now.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    switch (periodParam) {
      case 'today': {
        dateFrom = startOfDay(now);
        dateTo = endOfDay(now);
        break;
      }
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(now.getDate() - 1);
        dateFrom = startOfDay(y);
        dateTo = endOfDay(y);
        break;
      }
      case 'this-week': {
        const start = new Date(now);
        start.setDate(now.getDate() - mondayOffset);
        dateFrom = startOfDay(start);
        dateTo = endOfDay(now);
        break;
      }
      case 'this-month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFrom = startOfDay(start);
        dateTo = endOfDay(now);
        break;
      }
      default:
        break;
    }
  }

  const buyIns = buyInsParam
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n));

  const { points, debugEntries } = await getBankrollCurve(userId, {
    dateFrom,
    dateTo,
    hoursFrom: hoursFromParam ?? undefined,
    hoursTo: hoursToParam ?? undefined,
    buyIns,
    debug: debugParam === '1',
  });

  if (debugParam === '1') {
    // Log a compact summary and return details in response
    try {
      console.info('[bankroll-curve][debug] entries', debugEntries.slice(0, 5));
    } catch {
      // ignore logging failures
    }
    return NextResponse.json({ points, debug: debugEntries });
  }

  return NextResponse.json({ points });
}

