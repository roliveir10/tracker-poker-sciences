import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { invalidateMemberstackMemberCache } from '@/lib/memberstack';
import { getMemberstackPlan } from '@/lib/billing';

export const runtime = 'nodejs';

const VALID_TIERS = new Set(['FREE', 'LIMITED_50K', 'UNLIMITED']);

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 });
  }

  const account = await prisma.account.findFirst({
    where: { userId, provider: 'memberstack' },
    select: { id: true, providerAccountId: true },
  });

  if (!account?.providerAccountId) {
    return NextResponse.json({ ok: false, error: 'missing_member_link' }, { status: 200 });
  }

  const body = await req.json().catch(() => null) as { tier?: unknown; anchor?: unknown } | null;
  const tierCandidate = typeof body?.tier === 'string' ? body.tier.trim().toUpperCase() : null;
  let anchorIso: string | null = null;
  if (typeof body?.anchor === 'string') {
    const parsed = new Date(body.anchor);
    if (!Number.isNaN(parsed.getTime())) {
      anchorIso = parsed.toISOString();
    }
  }

  if (tierCandidate && VALID_TIERS.has(tierCandidate)) {
    try {
      await prisma.account.update({
        where: { id: account.id },
        data: { scope: tierCandidate, token_type: anchorIso },
      });
    } catch (err) {
      console.warn('[billing] failed to persist client tier sync', err);
    }
    return NextResponse.json({ ok: true, tier: tierCandidate, source: 'client' });
  }

  invalidateMemberstackMemberCache(account.providerAccountId);

  const plan = await getMemberstackPlan(userId);
  return NextResponse.json({ ok: true, tier: plan.tier, source: 'upstream' });
}
