import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
    },
  });
}


export async function DELETE(req: NextRequest) {
  try {
    // Si possible, identifie l'utilisateur pour invalider toutes ses sessions
    try {
      const session = await auth();
      const userId = session?.user?.id;
      if (userId) {
        await prisma.session.deleteMany({ where: { userId } });
      }
    } catch {}

    const token = req.cookies.get('__Secure-next-auth.session-token')?.value
      || req.cookies.get('next-auth.session-token')?.value
      || '';

    if (token) {
      try {
        await prisma.session.delete({ where: { sessionToken: token } });
      } catch {
        // session déjà absente → OK
      }
    }

    const res = NextResponse.json({ ok: true });
    const url = process.env.NEXTAUTH_URL || '';
    const isLocal = url.startsWith('http://') || /(^|\/)localhost(?=[:/]|$)/.test(url) || /127\.0\.0\.1/.test(url);
    const common = {
      httpOnly: true,
      secure: !isLocal,
      sameSite: (isLocal ? 'lax' : 'none') as 'lax' | 'none',
      path: '/',
      expires: new Date(0),
    };
    // Efface les deux variantes possibles
    res.cookies.set('next-auth.session-token', '', common);
    res.cookies.set('__Secure-next-auth.session-token', '', common);
    // Efface aussi les cookies CSRF pour éviter des états incohérents
    res.cookies.set('next-auth.csrf-token', '', { ...common, httpOnly: false });
    res.cookies.set('__Host-next-auth.csrf-token', '', { ...common, httpOnly: false });
    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

