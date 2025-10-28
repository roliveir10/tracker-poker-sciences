'use client';

import { useEffect, useRef } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { getMemberstackClient, openLoginModal, type MemberstackClient } from '@/lib/msClient';

type MemberIdentity = {
  memberId: string;
  email?: string | null;
  name?: string | null;
};

const DISABLE_COOKIE = 'ms_disable_autosso';

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const unwrapPayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') return payload;
  const candidate = payload as Record<string, unknown>;
  if ('member' in candidate && candidate.member && typeof candidate.member === 'object') {
    return candidate.member;
  }
  if ('data' in candidate && candidate.data && typeof candidate.data === 'object') {
    return unwrapPayload(candidate.data);
  }
  return payload;
};

const extractIdentity = (payload: unknown): MemberIdentity | null => {
  const unwrapped = unwrapPayload(payload);
  if (!unwrapped || typeof unwrapped !== 'object') return null;
  const candidate = unwrapped as {
    id?: unknown;
    email?: unknown;
    fullName?: unknown;
    name?: unknown;
    auth?: { email?: unknown; fullName?: unknown } | null;
    data?: { email?: unknown; fullName?: unknown; name?: unknown } | null;
  };

  const memberId = readString(candidate.id);
  if (!memberId) return null;

  const email =
    readString(candidate?.auth?.email) ??
    readString(candidate.email) ??
    readString(candidate.data?.email) ??
    null;

  const name =
    readString(candidate?.auth?.fullName) ??
    readString(candidate.fullName) ??
    readString(candidate.name) ??
    readString(candidate.data?.fullName) ??
    readString(candidate.data?.name) ??
    null;

  return { memberId, email, name };
};

const hasAutoSsoBlock = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((chunk) => chunk.trim().startsWith(`${DISABLE_COOKIE}=`));
};

const clearAutoSsoBlock = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${DISABLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export default function AutoSso() {
  const { data: session } = useSession();
  const sessionRef = useRef(session);
  const lastSyncedMemberIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let active = true;
    let memberstackClient: MemberstackClient | null = null;

    type SyncTarget = MemberIdentity | null;
    const syncState = {
      running: false,
      pending: undefined as SyncTarget | undefined,
    };

    const getSessionMemberId = (): string | null => {
      const currentSession = sessionRef.current;
      if (!currentSession?.user) return null;
      const candidate = (currentSession.user as { memberstackId?: string | null }).memberstackId;
      return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
    };

    const enqueueSync = (target: SyncTarget) => {
      if (!active) return;
      syncState.pending = target ?? null;
      if (syncState.running) return;

      syncState.running = true;
      (async () => {
        while (active) {
          const current = syncState.pending;
          syncState.pending = undefined;

          if (!active) break;

          const sessionMemberId = getSessionMemberId();

          if (current && current.memberId) {
            const alreadyProcessed = lastSyncedMemberIdRef.current === current.memberId;
            if (alreadyProcessed || sessionMemberId === current.memberId) {
              lastSyncedMemberIdRef.current = current.memberId;
            } else {
              clearAutoSsoBlock();
              try {
                const result = await signIn('memberstack', {
                  memberId: current.memberId,
                  email: current.email ?? undefined,
                  name: current.name ?? undefined,
                  redirect: false,
                });
                if (result?.error) {
                  console.error('[AutoSso] Unable to link Memberstack session', result.error);
                } else {
                  lastSyncedMemberIdRef.current = current.memberId;
                  try { await memberstackClient?.hideModal?.(); } catch {}
                  try { localStorage.setItem('ms_sso_done_at', String(Date.now())); } catch {}
                  try { sessionStorage.removeItem('ms_login_request_at'); } catch {}
                  try { localStorage.removeItem('ms_login_initiated'); } catch {}
                  let redirected = false;
                  try {
                    const targetUrl = localStorage.getItem('ms_post_login_redirect');
                    if (targetUrl) {
                      localStorage.removeItem('ms_post_login_redirect');
                      window.location.href = targetUrl;
                      redirected = true;
                    }
                  } catch {}
                  if (!redirected) {
                    if (window.location.pathname === '/') window.location.reload();
                    else window.location.href = '/';
                  }
                }
              } catch (err) {
                console.error('[AutoSso] Memberstack sign-in failed', err);
              }
            }
          } else {
            lastSyncedMemberIdRef.current = null;
            if (sessionMemberId) {
              try {
                await signOut({ redirect: false });
              } catch (err) {
                console.error('[AutoSso] signOut failed', err);
              }
            }
          }

          if (syncState.pending === undefined) break;
        }
      })()
        .catch((err) => {
          console.error('[AutoSso] sync loop failed', err);
        })
        .finally(() => {
          syncState.running = false;
        });
    };

    const loginHandler = () => {
      try { localStorage.setItem('ms_login_initiated', '1'); } catch {}
      void openLoginModal();
    };

    window.addEventListener('pksciences:login-requested', loginHandler as EventListener);

    let unsubscribe: (() => void) | undefined;

    (async () => {
      memberstackClient = await getMemberstackClient();
      if (!active || !memberstackClient) return;

      try {
        const currentMember = await memberstackClient.getCurrentMember?.({ useCache: true });
        const identity = extractIdentity(currentMember);
        if (identity && !hasAutoSsoBlock()) {
          enqueueSync(identity);
        }
      } catch (err) {
        console.warn('[AutoSso] failed to resolve current member', err);
      }

      unsubscribe = memberstackClient.onAuthChange?.((payload: unknown) => {
        enqueueSync(extractIdentity(payload));
      });
    })();

    return () => {
      active = false;
      window.removeEventListener('pksciences:login-requested', loginHandler as EventListener);
      unsubscribe?.();
    };
  }, []);

  return null;
}
