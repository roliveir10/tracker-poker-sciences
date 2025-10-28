'use client';

// Singleton Memberstack client loader for the browser only
// Ensures a single SDK instance is used across the app to avoid event/modal mismatches

type MemberstackModalType =
  | 'LOGIN'
  | 'SIGNUP'
  | 'PROFILE'
  | 'FORGOT_PASSWORD'
  | 'RESET_PASSWORD';

type MemberstackMemberPayload = {
  id?: string | null;
  data?: Record<string, unknown> | null;
  customFields?: Record<string, unknown> | null;
  fullName?: string | null;
  name?: string | null;
  auth?: { email?: string | null; fullName?: string | null } | null;
};

type MemberstackMemberResponse =
  | MemberstackMemberPayload
  | { data?: MemberstackMemberPayload | null }
  | null;

type MemberstackCheckoutPayload = {
  priceId: string;
  priceIds?: string[];
  successUrl: string;
  cancelUrl: string;
};

type MemberstackCustomerPortalPayload = {
  returnUrl: string;
};

export type MemberstackClient = {
  openModal?:
    | ((arg: { type: MemberstackModalType }) => Promise<unknown> | unknown)
    | ((type: MemberstackModalType) => Promise<unknown> | unknown);
  hideModal?: () => Promise<unknown> | unknown;
  logout?: () => Promise<unknown> | unknown;
  onAuthChange?: (cb: (payload: unknown) => void) => () => void;
  getCurrentMember?: (
    args?: { useCache?: boolean }
  ) => Promise<MemberstackMemberResponse> | MemberstackMemberResponse;
  updateMember?: (args: { customFields?: Record<string, unknown> }) => Promise<unknown> | unknown;
  updateMemberJSON?: (args: Record<string, unknown>) => Promise<unknown> | unknown;
  purchasePlansWithCheckout?: (args: MemberstackCheckoutPayload) => Promise<unknown> | unknown;
  launchStripeCustomerPortal?: (args: MemberstackCustomerPortalPayload) => Promise<unknown> | unknown;
};

declare global {
  interface Window {
    __msClientPromise?: Promise<MemberstackClient>;
  }
}

export async function getMemberstackClient(): Promise<MemberstackClient | null> {
  if (typeof window === 'undefined') return null;
  if (window.__msClientPromise) return window.__msClientPromise;

  const publicKey = process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY;
  if (!publicKey) return null;

  window.__msClientPromise = (async () => {
    const mod = await import('@memberstack/dom');
    const raw = await mod.default.init({ publicKey, useCookies: true });
    const ms = raw as unknown as MemberstackClient;
    try {
      window.dispatchEvent(new CustomEvent('pksciences:memberstack-ready', { detail: { ms } }));
    } catch {}
    return ms;
  })();

  return window.__msClientPromise;
}

export async function openLoginModal(msOverride?: MemberstackClient | null): Promise<boolean> {
  try {
    const ms = msOverride ?? (await getMemberstackClient());
    if (!ms) return false;
    const openModal = ms.openModal;
    if (typeof openModal === 'function') {
      try {
        const result = (openModal as (arg: { type: MemberstackModalType }) => unknown)({ type: 'LOGIN' });
        await Promise.resolve(result);
        return true;
      } catch {
        try {
          const result = (openModal as (type: MemberstackModalType) => unknown)('LOGIN');
          await Promise.resolve(result);
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
