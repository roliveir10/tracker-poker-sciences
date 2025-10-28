import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { fetchMemberstackMember } from '@/lib/memberstack';

export const runtime = 'nodejs';

type IncomingBody = {
  memberId?: string;
  name?: string;
  email?: string;
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: IncomingBody | null = null;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    // ignore malformed JSON to allow graceful error message
  }

  const providedMemberId = readString(body?.memberId);

  let accountMemberId = providedMemberId;
  if (!accountMemberId) {
    const existingAccount = await prisma.account.findFirst({
      where: { userId, provider: 'memberstack' },
      select: { providerAccountId: true },
    });
    accountMemberId = readString(existingAccount?.providerAccountId) ?? null;
  }

  if (!accountMemberId) {
    return NextResponse.json({ error: 'missing_member_id' }, { status: 400 });
  }

  const normalizedMemberId = accountMemberId;

  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'memberstack', providerAccountId: normalizedMemberId } },
    select: { userId: true },
  });
  if (existingAccount && existingAccount.userId !== userId) {
    return NextResponse.json({ error: 'member_already_linked' }, { status: 409 });
  }

  let memberEmail: string | null = null;
  let memberName: string | null = null;
  try {
    const member = await fetchMemberstackMember(normalizedMemberId);
    memberEmail =
      readString((member as { email?: unknown }).email) ??
      readString((member as { data?: { email?: unknown } | null })?.data?.email) ??
      null;
    memberName =
      readString((member as { fullName?: unknown }).fullName) ??
      readString((member as { name?: unknown }).name) ??
      readString((member as { data?: { fullName?: unknown; name?: unknown } | null })?.data?.fullName) ??
      readString((member as { data?: { name?: unknown } | null })?.data?.name) ??
      null;
  } catch (error) {
    console.error('[api/auth/memberstack] failed to fetch member', error);
  }

  const fallbackEmail = readString(body?.email);
  const effectiveEmail = memberEmail ?? fallbackEmail;
  if (!effectiveEmail) {
    return NextResponse.json({ error: 'member_email_not_found' }, { status: 400 });
  }

  const requestedName = readString(body?.name);
  const effectiveName = requestedName ?? memberName ?? null;

  try {
    const updateData: { email?: string; name?: string | null } = {};

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    if (currentUser.email !== effectiveEmail) {
      const conflict = await prisma.user.findUnique({ where: { email: effectiveEmail } });
      if (!conflict || conflict.id === userId) {
        updateData.email = effectiveEmail;
      }
    }

    if (effectiveName) {
      updateData.name = effectiveName;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'memberstack', providerAccountId: normalizedMemberId } },
      update: { userId },
      create: {
        userId,
        type: 'oauth',
        provider: 'memberstack',
        providerAccountId: normalizedMemberId,
      },
    });
  } catch (error) {
    console.error('[api/auth/memberstack] sync failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

