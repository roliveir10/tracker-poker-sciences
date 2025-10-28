type MemberstackPlanPayment = {
  priceId?: string | null;
  startDate?: string | null;
  currentPeriodStart?: string | null;
};

type MemberstackPlanPrice = {
  id?: string | null;
  amount?: number | null;
  currency?: string | null;
};

type MemberstackPlan = {
  id?: string | null;
  priceId?: string | null;
  defaultPriceId?: string | null;
  type?: string | null;
  prices?: MemberstackPlanPrice[] | null;
};

export type MemberstackPlanSummary = {
  id?: string | null;
  type?: string | null;
  defaultPriceId?: string | null;
  prices?: MemberstackPlanPrice[] | null;
};

export type MemberstackPlanConnection = {
  id?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  startDate?: string | null;
  planId?: string | null;
  plan?: MemberstackPlan | null;
  payment?: MemberstackPlanPayment | null;
};

type MemberstackMemberData = {
  email?: string;
  fullName?: string;
  planConnections?: MemberstackPlanConnection[] | { data?: MemberstackPlanConnection[] | null } | null;
} & Record<string, unknown>;

export type MemberstackMember = {
  id?: string;
  email?: string;
  fullName?: string;
  planConnections?: MemberstackPlanConnection[] | { data?: MemberstackPlanConnection[] | null } | null;
  data?: MemberstackMemberData | null;
};

const DEFAULT_BASE = 'https://api.memberstack.com/v2';
const CACHE_TTL_MS = Number(process.env.MEMBERSTACK_CACHE_TTL_MS || 30_000);
const PLAN_CACHE_TTL_MS = Number(process.env.MEMBERSTACK_PLAN_CACHE_TTL_MS || 5 * 60 * 1000);

const AUTH_HEADER_PARSE_ERROR = 'Invalid key=value pair (missing equal-sign) in Authorization header';

type MemberstackAuthMode = 'bearer' | 'x-api-key';

type CacheEntry = { value: MemberstackMember; expires: number };

const memberCache = new Map<string, CacheEntry>();
// Bloque temporairement les appels upstream en cas d'erreurs d'auth pour éviter le bruit et les quotas
let upstreamAuthBlockedUntil = 0;

function getCached(memberId: string): { fresh: MemberstackMember | null; stale: MemberstackMember | null } {
  const entry = memberCache.get(memberId);
  if (!entry) return { fresh: null, stale: null };
  const now = Date.now();
  if (now <= entry.expires) {
    return { fresh: entry.value, stale: entry.value };
  }
  memberCache.delete(memberId);
  return { fresh: null, stale: entry.value };
}

function setCached(memberId: string, value: MemberstackMember) {
  if (CACHE_TTL_MS <= 0) return;
  memberCache.set(memberId, { value, expires: Date.now() + CACHE_TTL_MS });
}

function buildMemberstackHeaders(apiKey: string, mode: MemberstackAuthMode): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (mode === 'bearer') {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers['x-api-key'] = apiKey;
  }
  return headers;
}

async function memberstackGet(url: string, apiKey: string): Promise<{ res: Response; text?: string }> {
  const attempt = (mode: MemberstackAuthMode) =>
    fetch(url, {
      method: 'GET',
      headers: buildMemberstackHeaders(apiKey, mode),
      // Ne pas envoyer de cookies cross-site
      credentials: 'omit',
    });

  // Choix du mode préféré via env; par défaut Memberstack API attend x-api-key côté serveur
  const preferredEnv = (process.env.MEMBERSTACK_AUTH_MODE || '').trim().toLowerCase();
  const preferred: MemberstackAuthMode = preferredEnv === 'bearer' ? 'bearer' : 'x-api-key';
  const modes: MemberstackAuthMode[] = preferred === 'x-api-key' ? ['x-api-key', 'bearer'] : ['bearer', 'x-api-key'];

  // 1er essai
  const res = await attempt(modes[0]!);
  if (res.ok) return { res };

  const text = await res.text().catch(() => '');

  // Déclenche un retry avec l'autre mode si 401/403 ou erreurs d'entête connues
  const shouldRetry =
    res.status === 401 ||
    res.status === 403 ||
    text.includes(AUTH_HEADER_PARSE_ERROR) ||
    /missing authentication token/i.test(text);

  if (shouldRetry) {
    const res2 = await attempt(modes[1]!);
    if (res2.ok) return { res: res2 };
    const retryText = await res2.text().catch(() => '');
    return { res: res2, text: retryText || text };
  }

  return { res, text };
}

export function invalidateMemberstackMemberCache(memberId: string): void {
  memberCache.delete(memberId);
}

type PlanCacheEntry = { value: MemberstackPlanSummary[]; expires: number };
let planCache: PlanCacheEntry | null = null;

export async function fetchMemberstackMember(memberId: string): Promise<MemberstackMember> {
  const apiKey = (process.env.MEMBERSTACK_API_KEY || '').trim();
  const baseUrl = process.env.MEMBERSTACK_API_BASE || DEFAULT_BASE;

  if (!apiKey || apiKey.toLowerCase().startsWith('pk_')) {
    const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
    if (!allowDevFallback) {
      throw new Error(!apiKey ? 'MEMBERSTACK_API_KEY is not set' : 'MEMBERSTACK_API_KEY looks like a public key (pk_...). Use an admin/server key.');
    }
    const { fresh, stale } = getCached(memberId);
    if (fresh) return fresh;
    // Dev seulement: renvoie un membre minimal. N’activez pas en prod.
    const devMember = stale ?? { id: memberId, email: `dev+${memberId}@example.com`, fullName: 'Dev Member' };
    setCached(memberId, devMember);
    return devMember;
  }

  const { fresh, stale } = getCached(memberId);
  if (fresh) return fresh;

  // Circuit breaker: si une erreur d'auth récente a été détectée, renvoie la version en cache si dispo
  if (Date.now() < upstreamAuthBlockedUntil && stale) {
    return stale;
  }

  const base = baseUrl.replace(/\/$/, '');
  const primaryUrl = `${base}/members/${encodeURIComponent(memberId)}?expand=planConnections,plan`;
  let { res, text: rawText } = await memberstackGet(primaryUrl, apiKey);

  let parsed: MemberstackMember | null = null;

  if (res.ok) {
    const json = (await res.json()) as unknown as { data?: MemberstackMember } | MemberstackMember;
    parsed = json && typeof (json as { data?: unknown }).data === 'object' && (json as { data?: MemberstackMember }).data
      ? (json as { data: MemberstackMember }).data
      : (json as MemberstackMember);
    if (parsed) setCached(memberId, parsed);
    return parsed;
  }

  const text = rawText ?? '';
  // Fallback d'URL: certains environnements utilisent encore /v1 ou un préfixe /admin
  const isMissingAuthToken = /missing authentication token/i.test(text) || res.status === 403;
  if (isMissingAuthToken) {
    const candidates: string[] = [];
    // v1 direct
    candidates.push(`${DEFAULT_BASE.replace('/v2', '/v1')}/members/${encodeURIComponent(memberId)}`);
    // admin prefix on current base
    candidates.push(`${base}/admin/members/${encodeURIComponent(memberId)}?expand=planConnections,plan`);
    // admin + v1
    candidates.push(`${DEFAULT_BASE.replace('/v2', '/v1')}/admin/members/${encodeURIComponent(memberId)}`);

    for (const url of candidates) {
      const { res: r2, text: t2 } = await memberstackGet(url, apiKey);
      if (r2.ok) {
        const json = (await r2.json()) as unknown as { data?: MemberstackMember } | MemberstackMember;
        parsed = json && typeof (json as { data?: unknown }).data === 'object' && (json as { data?: MemberstackMember }).data
          ? (json as { data: MemberstackMember }).data
          : (json as MemberstackMember);
        if (parsed) {
          setCached(memberId, parsed);
          return parsed;
        }
      }
      // Conserve le dernier message d'erreur si tous échouent
      res = r2;
      rawText = t2;
    }
  }

  // Fin fallbacks
  if (res.status === 401 || res.status === 403) {
    // Bloque les appels pendant 5 minutes en cas d'échec d'auth répété
    upstreamAuthBlockedUntil = Date.now() + 5 * 60 * 1000;
  }
  const finalText = rawText ?? text;
  const error = new Error(`Memberstack fetch failed: ${res.status} ${finalText}`.trim());
  if ((res.status === 429 || res.status === 403 || res.status === 404) && stale) {
    setCached(memberId, stale);
    return stale;
  }
  throw error;
}

export async function fetchMemberstackPlans(): Promise<MemberstackPlanSummary[]> {
  const apiKey = (process.env.MEMBERSTACK_API_KEY || '').trim();
  const baseUrl = process.env.MEMBERSTACK_API_BASE || DEFAULT_BASE;

  const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
  if (!apiKey) {
    if (!allowDevFallback) {
      throw new Error('MEMBERSTACK_API_KEY is not set');
    }
    return [];
  }

  const now = Date.now();
  if (planCache && planCache.expires > now) {
    return planCache.value;
  }

  const base = baseUrl.replace(/\/$/, '');
  const primaryUrl = `${base}/plans`;
  let { res, text } = await memberstackGet(primaryUrl, apiKey);

  if (!res.ok) {
    // Fallbacks d'URL similaires à fetchMemberstackMember
    const candidates: string[] = [];
    candidates.push(`${DEFAULT_BASE.replace('/v2', '/v1')}/plans`);
    candidates.push(`${base}/admin/plans`);
    candidates.push(`${DEFAULT_BASE.replace('/v2', '/v1')}/admin/plans`);

    for (const url of candidates) {
      const { res: r2, text: t2 } = await memberstackGet(url, apiKey);
      if (r2.ok) {
        res = r2;
        text = t2;
        break;
      }
      res = r2;
      text = t2;
    }
  }

  if (!res.ok) {
    const message = text ?? '';
    throw new Error(`Memberstack plans fetch failed: ${res.status} ${message}`.trim());
  }

  const json = (await res.json()) as unknown as { data?: MemberstackPlanSummary[] } | MemberstackPlanSummary[];
  const plans = Array.isArray((json as { data?: unknown }).data)
    ? ((json as { data?: MemberstackPlanSummary[] }).data ?? [])
    : (Array.isArray(json) ? (json as MemberstackPlanSummary[]) : []);

  planCache = { value: plans, expires: now + PLAN_CACHE_TTL_MS };
  return plans;
}

export function invalidateMemberstackPlanCache(): void {
  planCache = null;
}
