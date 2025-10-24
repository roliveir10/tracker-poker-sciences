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
        // 1) SSO silencieux si déjà connecté côté Memberstack
        const current = await ms.getCurrentMember();
        const currentId = typeof current?.data?.id === 'string' ? current.data.id : undefined;
        if (currentId) {
          const res = await fetch('/api/auth/memberstack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ memberId: currentId }),
          });
          if (!cancelled && res.ok) {
            window.location.href = '/';
            return;
          }
        }
        // 2) Sinon, écoute l'auth change pour déclencher le SSO après login
        type MemberstackMemberEvent = { data?: { id?: string | null } | null };
        ms.onAuthChange(async (member: MemberstackMemberEvent) => {
          if (cancelled) return;
          try {
            const memberId = typeof member?.data?.id === 'string' ? member.data.id : undefined;
            if (!memberId) return;
            const resp = await fetch('/api/auth/memberstack', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ memberId }),
            });
            if (!cancelled && resp.ok) {
              window.location.href = '/';
            }
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore silent
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}


