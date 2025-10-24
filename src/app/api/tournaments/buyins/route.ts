import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

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

  // Pull tournaments in date range, then filter by hours if provided
  const tournaments = await prisma.tournament.findMany({
    where: {
      userId,
      ...(dateFrom || dateTo
        ? {
            startedAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    },
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true, buyInCents: true },
  });

  let filtered = tournaments;
  if (hoursFromParam && hoursToParam) {
    const parseHhMm = (s: string) => {
      const [hh, mm] = s.split(':').map((v) => parseInt(v, 10));
      return (Math.max(0, Math.min(23, hh || 0)) * 60) + (Math.max(0, Math.min(59, mm || 0)));
    };
    const fromMin = parseHhMm(hoursFromParam);
    const toMin = parseHhMm(hoursToParam);
    const inRange = (d: Date) => {
      const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
      if (fromMin <= toMin) return minutes >= fromMin && minutes < toMin; // [from, to)
      return minutes >= fromMin || minutes < toMin; // wrap around
    };
    filtered = tournaments.filter((t) => (t.startedAt ? inRange(t.startedAt) : false));
  }

  const distinct = Array.from(
    new Set(filtered.map((t) => t.buyInCents).filter((v): v is number => Number.isFinite(v)))
  ).sort((a, b) => a - b);

  return NextResponse.json({ buyIns: distinct });
}

export const dynamic = 'force-dynamic';


