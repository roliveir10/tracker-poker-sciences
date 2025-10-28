'use client';

import { useEffect, useRef } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getMemberstackClient, openLoginModal, type MemberstackClient } from '@/lib/msClient';

type MemberIdentity = {
  memberId: string;
  email?: string | null;
  name?: string | null;
};

const DISABLE_COOKIE = 'ms_disable_autosso';
const LAST_ATTEMPT_KEY = 'ms_last_sso_attempt';
const LAST_MEMBER_KEY = 'ms_last_memberstack_id';
const SSO_COOLDOWN_MS = 15_000;

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

const readTimestamp = (key: string): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const writeTimestamp = (key: string, value: number): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore storage failures
  }
};

export default function AutoSso() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionRef = useRef(session);
  const lastSyncedMemberIdRef = useRef<string | null>(null);
  const lastAttemptRef = useRef<number>(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    lastAttemptRef.current = readTimestamp(LAST_ATTEMPT_KEY);
    lastSyncedMemberIdRef.current = (() => {
      try {
        return localStorage.getItem(LAST_MEMBER_KEY);
      } catch {
        return null;
      }
    })();
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

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

    const registerSuccessfulSync = (memberId: string) => {
      lastSyncedMemberIdRef.current = memberId;
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(LAST_MEMBER_KEY, memberId);
      } catch {
        // ignore
      }
    };

    const resetStoredSync = () => {
      lastSyncedMemberIdRef.current = null;
      if (typeof window === 'undefined') return;
      try {
        localStorage.removeItem(LAST_MEMBER_KEY);
        localStorage.removeItem(LAST_ATTEMPT_KEY);
      } catch {
        // ignore
      }
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
              registerSuccessfulSync(current.memberId);
            } else {
              const now = Date.now();
              const lastAttempt = Math.max(lastAttemptRef.current, readTimestamp(LAST_ATTEMPT_KEY));
              if (now - lastAttempt < SSO_COOLDOWN_MS) {
                const waitMs = Math.max(250, SSO_COOLDOWN_MS - (now - lastAttempt));
                const nextAttempt = current;
                setTimeout(() => {
                  if (!active) return;
                  enqueueSync(nextAttempt);
                }, waitMs);
                break;
              } else {
                lastAttemptRef.current = now;
                writeTimestamp(LAST_ATTEMPT_KEY, now);
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
                    registerSuccessfulSync(current.memberId);
                    try { await memberstackClient?.hideModal?.(); } catch {}
                    const stamp = Date.now();
                    try { localStorage.setItem('ms_sso_done_at', String(stamp)); } catch {}
                    try { sessionStorage.removeItem('ms_login_request_at'); } catch {}
                    try { localStorage.removeItem('ms_login_initiated'); } catch {}
                    try { localStorage.setItem(LAST_ATTEMPT_KEY, String(stamp)); } catch {}
                    lastAttemptRef.current = stamp;
                    const targetUrl = (() => {
                      try {
                        const stored = localStorage.getItem('ms_post_login_redirect');
                        if (stored) {
                          localStorage.removeItem('ms_post_login_redirect');
                          return stored;
                        }
                      } catch {}
                      return null;
                    })();
                    if (targetUrl) {
                      window.location.href = targetUrl;
                      return;
                    }
                    if (window.location.pathname === '/') {
                      router.refresh();
                      return;
                    } else {
                      router.push('/');
                      return;
                    }
                  }
                } catch (err) {
                  console.error('[AutoSso] Memberstack sign-in failed', err);
                }
              }
            }
          } else {
            if (sessionMemberId) {
              try {
                await signOut({ redirect: false });
              } catch (err) {
                console.error('[AutoSso] signOut failed', err);
              }
            }
            resetStoredSync();
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
  }, [router, status]);

  return null;
}
