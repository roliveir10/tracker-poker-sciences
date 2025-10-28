
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { PrismaClient } from '@prisma/client';
import { fetchMemberstackMember } from '@/lib/memberstack';
import { randomBytes } from 'node:crypto';

type IncomingBody = {
  memberId?: string;
  email?: string;
  name?: string;
};

type MemberstackMemberResponse = {
  email?: string | null;
  fullName?: string | null;
  name?: string | null;
  data?: {
    email?: string | null;
    fullName?: string | null;
    Pseudo?: string | null;
    pseudo?: string | null;
  } | null;
  customFields?: {
    Pseudo?: string | null;
    pseudo?: string | null;
  } | null;
};

function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

function getPrisma(): PrismaClient {
  if (process.env.VERCEL === '1') {
    // Sur Vercel, éviter de re-instancier les dépendances transpillées
    return new PrismaClient();
  }
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

type RequestContext = {
  origin?: string;
  secure: boolean;
  sameSite: 'lax' | 'none';
};

function resolveRequestContext(req: NextRequest): RequestContext {
  const envUrl = process.env.NEXTAUTH_URL?.trim();
  const originHeader = req.headers.get('origin') || undefined;
  const refererHeader = req.headers.get('referer') || undefined;
  const candidate = envUrl || originHeader || refererHeader || req.nextUrl.origin || '';

  let origin = candidate || undefined;
  let hostname: string | undefined;
  let protocol: string | undefined;

  if (candidate) {
    try {
      const parsed = new URL(candidate);
      origin = parsed.origin;
      hostname = parsed.hostname;
      protocol = parsed.protocol;
    } catch {
      // ignore malformed URL, fall back to env / origin header values
    }
  }

  const isDevEnv = process.env.NODE_ENV !== 'production';
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  const isHttp = protocol === 'http:';
  const forceInsecure = process.env.FORCE_INSECURE_AUTH_COOKIE === '1';

  const isLocal = forceInsecure || isHttp || isLoopback || isDevEnv;
  const secure = !isLocal;
  const sameSite = secure ? 'none' : 'lax';

  return { origin, secure, sameSite };
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


    // Vérification côté serveur auprès de Memberstack (avec court-circuit en dev)
  const allowDevEarly = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  let ms: MemberstackMemberResponse | null = null;
  // Si la clé API n'est pas configurée MAIS que le client fournit un email fiable, court-circuite la vérification upstream
  const noAdminApiKey = !process.env.MEMBERSTACK_API_KEY || process.env.MEMBERSTACK_API_KEY.trim() === '';
  if (allowDevEarly || noAdminApiKey) {
    const emailFromClient = body?.email?.trim();
    const nameFromClient = body?.name?.trim();
    if (emailFromClient) {
      ms = { email: emailFromClient, fullName: nameFromClient ?? null, data: { email: emailFromClient, fullName: nameFromClient ?? null } };
    }
  }
  if (!ms) {
    try {
      ms = (await fetchMemberstackMember(memberId)) as MemberstackMemberResponse;
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : e);
      const match = msg.match(/Memberstack fetch failed: (\d{3})/);
      const upstream = match ? parseInt(match[1]!, 10) : undefined;
      // Map erreurs côté Memberstack:
      // - 401/403: clé API invalide/interdite -> 502
      // - 4xx autres (400/404/422...): memberId invalide/non trouvé -> 400
      // - 5xx: 502
      if (msg.includes('401') || msg.includes('403') || msg.includes('MEMBERSTACK_API_KEY is not set')) {
        // Fallback dev: autorise en environnement de dev ou si DEV_FALLBACK=1
        const allowDev = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production' || noAdminApiKey;
        const emailFromClient = body?.email?.trim();
        const nameFromClient = body?.name?.trim();
        if (allowDev) {
          const fallbackEmail = emailFromClient || `dev+${memberId}@local.test`;
          ms = { email: fallbackEmail, fullName: nameFromClient ?? null, data: { email: fallbackEmail, fullName: nameFromClient ?? null } };
        } else {
          return NextResponse.json({ error: 'upstream_auth_error', upstream }, { status: 502 });
        }
      }
      if (msg.includes('404') || msg.includes('400') || msg.includes('422')) {
        return NextResponse.json({ error: 'member_not_found' }, { status: 400 });
      }
      return NextResponse.json({ error: 'upstream_error', upstream }, { status: 502 });
    }
  }
  const readString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  const email: string | null = readString(ms?.email) ?? readString(ms?.data?.email);
  const pseudo: string | null =
    readString(ms?.data?.Pseudo) ??
    readString(ms?.data?.pseudo) ??
    readString(ms?.customFields?.Pseudo) ??
    readString(ms?.customFields?.pseudo);
  const name: string | null =
    pseudo ??
    readString(ms?.fullName) ??
    readString(ms?.name) ??
    readString(ms?.data?.fullName);

    if (!email) {
      return NextResponse.json({ error: 'member_email_not_found' }, { status: 400 });
    }

    // Upsert utilisateur local via email (unique)
    const prisma = getPrisma();
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
    const ctx = resolveRequestContext(req);
    if (ctx.origin) {
      res.headers.set('Access-Control-Allow-Origin', ctx.origin);
    }
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    // Cookies: considère "local" uniquement pour http://localhost
    // Ajuste les cookies pour Cloudflare tunnel/domains externes: toujours SameSite=None + Secure
    const cookieCommon = {
      httpOnly: true,
      secure: ctx.secure,
      sameSite: ctx.sameSite,
      path: '/',
      expires,
    };
    res.cookies.set('__Secure-next-auth.session-token', token, cookieCommon);
    // Compat
    res.cookies.set('next-auth.session-token', token, cookieCommon);
    return res;
  } catch (err: unknown) {
    console.error('[api/auth/memberstack] error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  const ctx = resolveRequestContext(req);
  if (ctx.origin) {
    res.headers.set('Access-Control-Allow-Origin', ctx.origin);
  }
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  return res;
}
