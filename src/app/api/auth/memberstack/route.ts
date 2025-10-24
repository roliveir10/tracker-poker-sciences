import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';
import { fetchMemberstackMember } from '@/lib/memberstack';
import { randomBytes } from 'node:crypto';

type IncomingBody = {
  memberId?: string;
};

type MemberstackMemberResponse = {
  email?: string | null;
  fullName?: string | null;
  name?: string | null;
  data?: {
    email?: string | null;
    fullName?: string | null;
  } | null;
};

function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', process.env.WEBFLOW_ORIGIN || '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'invalid_content_type' }, { status: 415 });
    }

    const body = (await req.json()) as IncomingBody | null;
    const memberId = body?.memberId?.trim();
    if (!memberId) {
      return NextResponse.json({ error: 'missing_member_id' }, { status: 400 });
    }

    // Vérification côté serveur auprès de Memberstack
    let ms: MemberstackMemberResponse | null = null;
    try {
      ms = (await fetchMemberstackMember(memberId)) as MemberstackMemberResponse;
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      if (msg.includes('404')) {
        return NextResponse.json({ error: 'member_not_found' }, { status: 400 });
      }
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
    }
    const email: string | null = ms.email ?? ms.data?.email ?? null;
    const name: string | null = ms.fullName ?? ms.name ?? ms.data?.fullName ?? null;

    if (!email) {
      return NextResponse.json({ error: 'member_email_not_found' }, { status: 400 });
    }

    // Upsert utilisateur local via email (unique)
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: name ?? undefined },
      create: { email, name: name ?? undefined },
    });

    // Lier (ou créer) le compte provider 'memberstack' pour ce user
    await prisma.account.upsert({
      where: { provider_providerAccountId: { provider: 'memberstack', providerAccountId: memberId } },
      update: { userId: user.id },
      create: {
        userId: user.id,
        type: 'oauth',
        provider: 'memberstack',
        providerAccountId: memberId,
      },
    });

    // Crée une session DB et dépose le cookie de session pour NextAuth
    const token = createSessionToken();
    const maxAgeSec = 30 * 24 * 60 * 60; // 30 jours
    const expires = new Date(Date.now() + maxAgeSec * 1000);

    await prisma.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        expires,
      },
    });

    const res = NextResponse.json({ ok: true });
    res.headers.set('Access-Control-Allow-Origin', process.env.WEBFLOW_ORIGIN || '*');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    // Autoriser le set-cookie en cross-site depuis Webflow → SameSite=None; Secure
    res.cookies.set('__Secure-next-auth.session-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      expires,
    });
    // Compat: certains environnements utilisent encore ce nom
    res.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      expires,
    });
    return res;
  } catch (err: unknown) {
    console.error('[api/auth/memberstack] error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}


