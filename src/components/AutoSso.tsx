'use client';

import { useEffect } from 'react';
import { getMemberstackClient, openLoginModal } from '@/lib/msClient';
// Import dynamique pour éviter toute éval SSR

async function getSessionStatus(): Promise<{ authenticated: boolean }>{
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('/api/session', { credentials: 'include', signal: ctl.signal });
    clearTimeout(t);
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
    const run = async () => {
      // Si un cookie anti-autosso est présent, ne pas tenter de SSO silencieux
      try {
        const hasBlock = typeof document !== 'undefined' && document.cookie.split(';').some((c) => c.trim().startsWith('ms_disable_autosso='));
        if (hasBlock) return;
      } catch {}
      const session = await getSessionStatus();
      if (cancelled || session.authenticated) return;

      // Anti-boucle: éviter de relancer le SSO immédiatement après succès
      try {
        const last = localStorage.getItem('ms_sso_done_at');
        if (last && Date.now() - parseInt(last, 10) < 2 * 60 * 1000) return;
      } catch {}

      try {
        const ms = await getMemberstackClient();
        if (!ms) return;

        // Désactivé: pas de SSO silencieux automatique à l'initialisation
        // 2) Sinon, écoute l'auth change pour déclencher le SSO après login
        type MemberstackMember = { id?: string | null; auth?: { email?: string | null; fullName?: string | null } };
        const unwrapMemberResponse = (payload: unknown): unknown => {
          if (payload && typeof payload === 'object') {
            const record = payload as Record<string, unknown>;
            if ('data' in record && record.data && typeof record.data === 'object') {
              return record.data;
            }
          }
          return payload;
        };
        const extractMember = (payload: unknown): MemberstackMember | null => {
          if (!payload) return null;
          if (typeof payload === 'object') {
            const obj = payload as Record<string, unknown>;
            if (obj && ('id' in obj || 'auth' in obj)) {
              return obj as MemberstackMember;
            }
            if ('member' in obj && obj.member && typeof obj.member === 'object') {
              return obj.member as MemberstackMember;
            }
            if ('data' in obj && obj.data && typeof obj.data === 'object') {
              return extractMember(obj.data);
            }
          }
          return null;
        };

        ms.onAuthChange?.(async (raw: unknown) => {
          if (cancelled) return;
          const member = extractMember(unwrapMemberResponse(raw));
          const memberId = typeof member?.id === 'string' ? member.id : undefined;
          if (!memberId) return;
          // Ferme immédiatement le modal pour signaler le progrès de connexion
          try { await ms.hideModal?.(); } catch {}
          try {
            const email = (member?.auth?.email as string | undefined) ?? undefined;
            const name = (member?.auth?.fullName as string | undefined) ?? undefined;
            const resp = await fetch('/api/auth/memberstack', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ memberId, email, name }),
            });
            if (cancelled) return;
            if (resp.ok) {
              try { localStorage.setItem('ms_sso_done_at', String(Date.now())); } catch {}
              try {
                window.dispatchEvent(new CustomEvent('pksciences:auth-changed', {
                  detail: { authenticated: true, email: email ?? null },
                  bubbles: false,
                }));
              } catch {}
              try { sessionStorage.removeItem('ms_active_login_modal'); } catch {}
              try { await ms.hideModal?.(); } catch {}
              try { localStorage.removeItem('ms_login_initiated'); } catch {}
              // Redirection prioritaire après login si une cible a été définie
              try {
                const target = localStorage.getItem('ms_post_login_redirect');
                if (target) {
                  localStorage.removeItem('ms_post_login_redirect');
                  window.location.href = target;
                  return;
                }
              } catch {}
              if (window.location.pathname !== '/') window.location.href = '/';
              else window.location.reload();
              return;
            }
            if (resp.status === 502) {
              try {
                if (ms.logout) {
                  await ms.logout();
                }
              } catch {}
              try {
                window.dispatchEvent(new CustomEvent('pksciences:auth-changed', {
                  detail: { authenticated: false },
                  bubbles: false,
                }));
              } catch {}
              return;
            }
            try {
              const text = await resp.text().catch(() => '');
              console.error('[AutoSso] auth change sync failed', resp.status, text);
            } catch {}
          } catch {
            // ignore
          }
        });

        // Si un clic "login" a été initié avant que le SDK soit prêt, ouvrir maintenant
        try {
          const ts = sessionStorage.getItem('ms_login_request_at');
          const requested = ts ? (Date.now() - parseInt(ts, 10) < 30 * 1000) : false;
          if (requested) await openLoginModal(ms);
        } catch {}
        // Aucun overlay additionnel nécessaire
      } catch {
        // ignore silent
      }
    };
    // Initialise immédiatement pour éviter les courses avec la sidebar
    run();
    return () => { cancelled = true; };
  }, []);

  // Écouteur global: ouvre le modal à la demande si le SDK est prêt
  useEffect(() => {
    let disposed = false;
    const handler = async () => {
      if (disposed) return;
      try { localStorage.setItem('ms_login_initiated', '1'); } catch {}
      await openLoginModal();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pksciences:login-requested', handler as EventListener);
    }
    return () => {
      disposed = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pksciences:login-requested', handler as EventListener);
      }
    };
  }, []);
  return null;
}
