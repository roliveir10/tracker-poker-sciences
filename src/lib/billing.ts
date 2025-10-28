import { prisma } from '@/lib/prisma';
import {
  fetchMemberstackMember,
  fetchMemberstackPlans,
  type MemberstackMember,
  type MemberstackPlanConnection,
  type MemberstackPlanSummary,
} from '@/lib/memberstack';

type Tier = 'FREE' | 'LIMITED_50K' | 'UNLIMITED';

type PlanInfo = {
  tier: Tier;
  paidAnchorAt: Date | null;
};

type PlanConnectionContainer =
  | MemberstackPlanConnection[]
  | { data?: MemberstackPlanConnection[] | null }
  | null
  | undefined;

type MemberstackMemberWithPlans = MemberstackMember & {
  data?: (MemberstackMember['data'] & {
    plan_connections?: PlanConnectionContainer;
  }) | null;
};

const FREE_LIMIT_DEFAULT = Number(process.env.MS_FREE_MONTHLY_LIMIT || 5000);
const LIMITED_LIMIT_DEFAULT = Number(process.env.MS_LIMITED_MONTHLY_LIMIT || 50000);

const PRICE_50K = process.env.MS_PRICE_ID_50K || process.env.NEXT_PUBLIC_MS_PRICE_ID_50K || '';
const PRICE_UNLIMITED = process.env.MS_PRICE_ID_UNLIMITED || process.env.NEXT_PUBLIC_MS_PRICE_ID_UNLIMITED || '';
const ACTIVE_STATUSES = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE']);

function limitForTier(tier: Tier): number {
  if (tier === 'UNLIMITED') return Number.POSITIVE_INFINITY;
  if (tier === 'LIMITED_50K') return LIMITED_LIMIT_DEFAULT;
  return FREE_LIMIT_DEFAULT;
}

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

type PlanLike = {
  priceId?: string | null;
  defaultPriceId?: string | null;
  prices?: Array<{ id?: string | null } | null> | null;
};

type TierLookup = {
  limitedPriceIds: Set<string>;
  limitedPlanIds: Set<string>;
  unlimitedPriceIds: Set<string>;
  unlimitedPlanIds: Set<string>;
};

function collectNormalizedPriceIds(plan: PlanLike | null | undefined): string[] {
  const values = new Set<string>();
  const push = (id: string | null | undefined) => {
    const normalized = normalizeId(id);
    if (normalized) values.add(normalized);
  };
  if (!plan) return [];
  push(plan.priceId);
  push(plan.defaultPriceId);
  if (Array.isArray(plan.prices)) {
    for (const price of plan.prices) {
      if (!price) continue;
      push(price.id);
    }
  }
  return Array.from(values);
}

function collectConnectionPriceIds(connection: MemberstackPlanConnection): string[] {
  const collector = new Set<string>();
  const push = (id: string | null | undefined) => {
    const normalized = normalizeId(id);
    if (normalized) collector.add(normalized);
  };
  push(connection?.payment?.priceId);
  // Some API shapes expose direct priceId on the connection/plan
  push((connection as unknown as { priceId?: string | null })?.priceId);
  push(connection?.plan?.priceId);
  push(connection?.plan?.defaultPriceId);
  for (const id of collectNormalizedPriceIds(connection?.plan ?? null)) {
    collector.add(id);
  }
  return Array.from(collector);
}

function collectConnectionPlanIds(connection: MemberstackPlanConnection): string[] {
  const collector = new Set<string>();
  const push = (id: string | null | undefined) => {
    const normalized = normalizeId(id);
    if (normalized) collector.add(normalized);
  };
  push(connection?.planId);
  push(connection?.plan?.id);
  return Array.from(collector);
}

function buildTierLookup(
  plans: MemberstackPlanSummary[],
  limitedEnv: string | null,
  unlimitedEnv: string | null,
): TierLookup {
  const limitedPriceIds = new Set<string>();
  const limitedPlanIds = new Set<string>();
  const unlimitedPriceIds = new Set<string>();
  const unlimitedPlanIds = new Set<string>();

  if (limitedEnv) limitedPriceIds.add(limitedEnv);
  if (unlimitedEnv) unlimitedPriceIds.add(unlimitedEnv);

  const limitedTargets = new Set<string>(limitedEnv ? [limitedEnv] : []);
  const unlimitedTargets = new Set<string>(unlimitedEnv ? [unlimitedEnv] : []);

  for (const plan of plans) {
    const planId = normalizeId(plan?.id ?? null);
    const priceIds = collectNormalizedPriceIds(plan ?? null);
    const matchesLimited = priceIds.some((id) => limitedTargets.has(id));
    const matchesUnlimited = priceIds.some((id) => unlimitedTargets.has(id));

    if (matchesLimited) {
      if (planId) limitedPlanIds.add(planId);
      for (const id of priceIds) {
        limitedPriceIds.add(id);
        limitedTargets.add(id);
      }
    }
    if (matchesUnlimited) {
      if (planId) unlimitedPlanIds.add(planId);
      for (const id of priceIds) {
        unlimitedPriceIds.add(id);
        unlimitedTargets.add(id);
      }
    }
  }

  return { limitedPriceIds, limitedPlanIds, unlimitedPriceIds, unlimitedPlanIds };
}

function pickAnchorDate(planConnection: MemberstackPlanConnection): Date | null {
  const candidates = [
    planConnection?.payment?.startDate,
    planConnection?.payment?.currentPeriodStart,
    planConnection?.startDate,
    planConnection?.createdAt,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function unwrapPlanConnections(container: PlanConnectionContainer): MemberstackPlanConnection[] {
  if (!container) return [];
  if (Array.isArray(container)) return container.filter(Boolean);
  if (container && typeof container === 'object' && Array.isArray(container.data)) {
    return container.data.filter(Boolean);
  }
  return [];
}

function extractPlanConnections(member: MemberstackMemberWithPlans): MemberstackPlanConnection[] {
  const sources: PlanConnectionContainer[] = [
    member?.planConnections,
    member?.data?.planConnections,
    member?.data?.plan_connections,
  ];
  const seen = new Set<string>();
  const result: MemberstackPlanConnection[] = [];
  for (const source of sources) {
    for (const connection of unwrapPlanConnections(source)) {
      const id = typeof connection?.id === 'string' && connection.id.length > 0 ? connection.id : undefined;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      result.push(connection);
    }
  }
  return result;
}

export async function getMemberstackPlan(userId: string): Promise<PlanInfo> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'memberstack' },
    select: { id: true, providerAccountId: true, scope: true, token_type: true },
  });
  if (!account?.providerAccountId) {
    return { tier: 'FREE', paidAnchorAt: null };
  }

  const normalizeTierString = (value: string | null | undefined): Tier | null => {
    if (typeof value !== 'string') return null;
    const upper = value.trim().toUpperCase();
    if (upper === 'FREE' || upper === 'LIMITED_50K' || upper === 'UNLIMITED') return upper as Tier;
    return null;
  };

  let cachedTier = normalizeTierString(account.scope ?? null);
  let cachedAnchor: Date | null = null;
  if (typeof account.token_type === 'string' && account.token_type.trim().length > 0) {
    const parsed = new Date(account.token_type);
    if (!Number.isNaN(parsed.getTime())) {
      cachedAnchor = parsed;
    }
  }

  const hasAdminApiKey = Boolean(process.env.MEMBERSTACK_API_KEY && process.env.MEMBERSTACK_API_KEY.trim().length > 0);

  const persistPlan = async (tier: Tier, anchor: Date | null) => {
    const iso = anchor ? anchor.toISOString() : null;
    const cachedIso = cachedAnchor ? cachedAnchor.toISOString() : null;
    if (cachedTier === tier && cachedIso === iso) return;
    try {
      await prisma.account.update({
        where: { id: account.id },
        data: { scope: tier, token_type: iso },
      });
      cachedTier = tier;
      cachedAnchor = anchor ?? null;
    } catch (err) {
      console.warn(`[billing] failed to persist plan cache for user ${userId}`, err);
    }
  };

  if (!hasAdminApiKey && cachedTier) {
    return { tier: cachedTier, paidAnchorAt: cachedAnchor };
  }

  try {
    const member = (await fetchMemberstackMember(account.providerAccountId)) as MemberstackMemberWithPlans;
    const planConnections = extractPlanConnections(member);
    const normalized50k = normalizeId(PRICE_50K);
    const normalizedUnlimited = normalizeId(PRICE_UNLIMITED);

    let planCatalog: MemberstackPlanSummary[] = [];
    try {
      planCatalog = await fetchMemberstackPlans();
    } catch (err) {
      console.warn('[billing] unable to fetch Memberstack plans catalog', err);
    }
    const lookup = buildTierLookup(planCatalog, normalized50k, normalizedUnlimited);

    const activeConnections = planConnections.filter((pc) => {
      if (!pc) return false;
      const status = typeof pc.status === 'string' ? pc.status.toUpperCase() : '';
      return ACTIVE_STATUSES.has(status);
    });
    if (planConnections.length > 0 && activeConnections.length === 0) {
      console.warn(`[billing] no active plan connection detected for user ${userId}`, planConnections.map((pc) => ({
        status: pc?.status,
        planId: pc?.planId ?? pc?.plan?.id,
        priceId: pc?.payment?.priceId ?? pc?.plan?.priceId ?? pc?.plan?.defaultPriceId,
      })));
    }

    let fallbackPaidConnection: MemberstackPlanConnection | null = null;

    for (const connection of activeConnections) {
      const priceIds = collectConnectionPriceIds(connection);
      const planIds = collectConnectionPlanIds(connection);
      const planType = typeof connection?.plan?.type === 'string'
        ? connection.plan.type.toUpperCase()
        : null;
      const isPaidPlan = planType === 'PAID' || priceIds.length > 0;
      if (!isPaidPlan) continue;

      if (!fallbackPaidConnection) {
        fallbackPaidConnection = connection;
      }

      const paidAnchorAt = pickAnchorDate(connection) ?? new Date();
      const matchesUnlimited =
        priceIds.some((id) => lookup.unlimitedPriceIds.has(id)) ||
        planIds.some((id) => lookup.unlimitedPlanIds.has(id)) ||
        (normalizedUnlimited ? priceIds.includes(normalizedUnlimited) || planIds.includes(normalizedUnlimited) : false);
      if (matchesUnlimited) {
        await persistPlan('UNLIMITED', paidAnchorAt);
        return { tier: 'UNLIMITED', paidAnchorAt };
      }

      const matchesLimited =
        priceIds.some((id) => lookup.limitedPriceIds.has(id)) ||
        planIds.some((id) => lookup.limitedPlanIds.has(id)) ||
        (normalized50k ? priceIds.includes(normalized50k) || planIds.includes(normalized50k) : false);
      if (matchesLimited) {
        await persistPlan('LIMITED_50K', paidAnchorAt);
        return { tier: 'LIMITED_50K', paidAnchorAt };
      }

      console.warn(`[billing] unmatched paid plan connection for user ${userId}, falling back to LIMITED_50K`, {
        planIds,
        priceIds,
        planType,
      });
      await persistPlan('LIMITED_50K', paidAnchorAt);
      return { tier: 'LIMITED_50K', paidAnchorAt };
    }

    if (fallbackPaidConnection) {
      const paidAnchorAt = pickAnchorDate(fallbackPaidConnection) ?? new Date();
      await persistPlan('LIMITED_50K', paidAnchorAt);
      return { tier: 'LIMITED_50K', paidAnchorAt };
    }
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err);
    const isAuthIssue = message.includes('Memberstack fetch failed: 401') || message.includes('Memberstack fetch failed: 403') || message.includes('MEMBERSTACK_API_KEY is not set');
    if (isAuthIssue) {
      // Attendu lorsque la clé admin est indisponible/incorrecte temporairement: bruit inutile côté logs
      console.info(`[billing] Memberstack indisponible (auth), utilisation du cache/fallback pour user ${userId}`);
    } else {
      console.warn(`[billing] memberstack plan lookup failed for user ${userId}`, err);
    }
    // Fallback: pas d'info Memberstack → FREE/cache
  }

  if (cachedTier) {
    return { tier: cachedTier, paidAnchorAt: cachedAnchor };
  }

  await persistPlan('FREE', null);
  return { tier: 'FREE', paidAnchorAt: null };
}

export async function getUsageWindow(userId: string, planOverride?: PlanInfo): Promise<{ start: Date; end: Date; tier: Tier }> {
  const { tier, paidAnchorAt } = planOverride ?? (await getMemberstackPlan(userId));

  // now and cutoff (30 jours)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let anchor: Date | null = null;
  if (tier === 'FREE') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    anchor = user?.createdAt ?? null;
  } else {
    anchor = paidAnchorAt ?? null;
  }
  const start = new Date(Math.max((anchor?.getTime() ?? 0), thirtyDaysAgo.getTime()));
  return { start, end: now, tier };
}

export async function getMonthlyLimit(userId: string, planOverride?: PlanInfo): Promise<number> {
  const { tier } = planOverride ?? (await getMemberstackPlan(userId));
  return limitForTier(tier);
}

export async function getMonthlyUsage(userId: string, windowOverride?: { start: Date; end: Date }): Promise<number> {
  const { start, end } = windowOverride ?? (await getUsageWindow(userId));
  // Compte les mains créées dans la fenêtre, pour les tournois de ce user
  const used = await prisma.hand.count({
    where: {
      createdAt: { gte: start, lt: end },
      tournament: { userId },
    },
  });
  return used;
}

export async function getRemaining(userId: string): Promise<{ used: number; limit: number; remaining: number; window: { start: Date; end: Date }; tier: Tier }>{
  const planInfo = await getMemberstackPlan(userId);
  const windowInfo = await getUsageWindow(userId, planInfo);
  const usage = await getMonthlyUsage(userId, { start: windowInfo.start, end: windowInfo.end });
  const limit = limitForTier(planInfo.tier);
  const remaining = Number.isFinite(limit) ? Math.max(0, limit - usage) : Number.POSITIVE_INFINITY;
  return { used: usage, limit, remaining, window: { start: windowInfo.start, end: windowInfo.end }, tier: planInfo.tier };
}
