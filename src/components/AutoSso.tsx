'use client';

import { useEffect } from 'react';

async function getSessionStatus(): Promise<{ authenticated: boolean }>{
  try {
    const r = await fetch('/api/session', { credentials: 'include' });
    if (!r.ok) return { authenticated: false };
    const j = await r.json().catch(() => null);
    return { authenticated: Boolean(j?.authenticated) };
  } catch {
    return { authenticated: false };
  }
}

export default function AutoSso() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSessionStatus();
      if (cancelled || session.authenticated) return;

      try {
        const publicKey = process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY;
        if (!publicKey) return;
        // Charge Memberstack uniquement côté client pour éviter toute évaluation SSR
        const mod = await import('@memberstack/dom');
        const ms = await mod.default.init({ publicKey });
        const member = await ms.getCurrentMember();
        const memberId = typeof member?.data?.id === 'string' ? member.data.id : undefined;
        if (!memberId) return;
        const res = await fetch('/api/auth/memberstack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ memberId }),
        });
        if (cancelled) return;
        if (res.ok) window.location.reload();
      } catch {
        // ignore silent
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}


