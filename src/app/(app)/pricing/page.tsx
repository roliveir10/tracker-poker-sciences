"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMemberstackClient, type MemberstackClient } from "@/lib/msClient";
import type { MemberstackPlanConnection } from "@/lib/memberstack";

const ESSENTIAL_PRICE_ID = process.env.NEXT_PUBLIC_MS_PRICE_ID_50K ?? "";
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_MS_PRICE_ID_UNLIMITED ?? "";
const ACTIVE_MEMBERSTACK_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

type CheckoutArgs = { priceId: string; priceIds?: string[]; successUrl: string; cancelUrl: string };
type BillingPortalArgs = { returnUrl: string };

function resolveCheckout(client: MemberstackClient): ((args: CheckoutArgs) => Promise<unknown>) | null {
  const candidate = (client as { purchasePlansWithCheckout?: unknown }).purchasePlansWithCheckout;
  return typeof candidate === "function" ? (candidate as (args: CheckoutArgs) => Promise<unknown>) : null;
}

function resolveBillingPortal(client: MemberstackClient): ((args: BillingPortalArgs) => Promise<unknown>) | null {
  const candidate = (client as { launchStripeCustomerPortal?: unknown }).launchStripeCustomerPortal;
  return typeof candidate === "function" ? (candidate as (args: BillingPortalArgs) => Promise<unknown>) : null;
}

function extractErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    if (err instanceof Error && typeof err.message === "string" && err.message.trim().length > 0) return err.message;
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) return maybeMessage;
    const directError = (err as { error?: unknown }).error;
    if (typeof directError === "string" && directError.trim().length > 0) return directError;
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const dataMessage = (data as { message?: unknown }).message;
      if (typeof dataMessage === "string" && dataMessage.trim().length > 0) return dataMessage;
      const dataError = (data as { error?: unknown }).error;
      if (typeof dataError === "string" && dataError.trim().length > 0) return dataError;
      if (Array.isArray((data as { errors?: unknown }).errors)) {
        for (const item of (data as { errors: unknown[] }).errors) {
          if (typeof item === "string" && item.trim().length > 0) return item;
          if (item && typeof item === "object") {
            const itemMessage = (item as { message?: unknown }).message;
            if (typeof itemMessage === "string" && itemMessage.trim().length > 0) return itemMessage;
          }
        }
      }
    }
    if (Array.isArray((err as { errors?: unknown }).errors)) {
      for (const item of (err as { errors: unknown[] }).errors ?? []) {
        if (typeof item === "string" && item.trim().length > 0) return item;
        if (item && typeof item === "object") {
          const itemMessage = (item as { message?: unknown }).message;
          if (typeof itemMessage === "string" && itemMessage.trim().length > 0) return itemMessage;
        }
      }
    }
  }
  return null;
}

function shouldRetryWithPriceIds(err: unknown): boolean {
  const message = extractErrorMessage(err);
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("priceids") || lower.includes("price ids") || lower.includes("array of price");
}

function extractErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  if (err instanceof Error) {
    const errorCode = (err as { code?: unknown }).code;
    if (typeof errorCode === "string") return errorCode;
  }
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") return code;
  const data = (err as { data?: { code?: unknown } | null }).data;
  if (data && typeof data === "object") {
    const nestedCode = (data as { code?: unknown }).code;
    if (typeof nestedCode === "string") return nestedCode;
  }
  return null;
}

type UsageTier = "FREE" | "LIMITED_50K" | "UNLIMITED";

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function unwrapPlanConnections(source: unknown): MemberstackPlanConnection[] {
  if (!source) return [];
  if (Array.isArray(source)) return source.filter(Boolean) as MemberstackPlanConnection[];
  if (typeof source === "object" && Array.isArray((source as { data?: unknown }).data)) {
    return ((source as { data?: MemberstackPlanConnection[] }).data ?? []).filter(Boolean);
  }
  return [];
}

function extractPlanConnections(member: unknown): MemberstackPlanConnection[] {
  if (!member || typeof member !== "object") return [];
  const cast = member as { planConnections?: unknown; data?: { planConnections?: unknown; plan_connections?: unknown } | null };
  const buckets = [cast.planConnections, cast.data?.planConnections, cast.data?.plan_connections];
  const seen = new Set<string>();
  const result: MemberstackPlanConnection[] = [];
  for (const bucket of buckets) {
    for (const connection of unwrapPlanConnections(bucket)) {
      const id = typeof connection?.id === "string" && connection.id.length > 0 ? connection.id : undefined;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      result.push(connection);
    }
  }
  return result;
}

function collectConnectionPriceIds(connection: MemberstackPlanConnection | null | undefined): string[] {
  if (!connection) return [];
  const collector = new Set<string>();
  const push = (id: string | null | undefined) => {
    const normalized = normalizeId(id);
    if (normalized) collector.add(normalized);
  };
  push(connection?.payment?.priceId);
  push((connection as unknown as { priceId?: string | null })?.priceId);
  push(connection?.plan?.priceId);
  push(connection?.plan?.defaultPriceId);
  if (Array.isArray(connection?.plan?.prices)) {
    for (const price of connection.plan.prices ?? []) {
      if (!price) continue;
      push(price.id);
    }
  }
  return Array.from(collector);
}

function pickAnchorDate(connection: MemberstackPlanConnection | null | undefined): string | null {
  if (!connection) return null;
  const candidates = [
    connection?.payment?.startDate,
    connection?.payment?.currentPeriodStart,
    connection?.startDate,
    connection?.createdAt,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  return null;
}

export default function PricingPage() {
  const [activeTier, setActiveTier] = useState<UsageTier | null>(null);
  const [activeAnchorIso, setActiveAnchorIso] = useState<string | null>(null);
  const [tierSource, setTierSource] = useState<"unknown" | "memberstack">("unknown");
  const syncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ms = await getMemberstackClient();
        if (!ms) return;
        const response = await (ms as { getCurrentMember?: (args?: { useCache?: boolean }) => Promise<unknown> }).getCurrentMember?.({ useCache: true });
        const member = (response as { data?: unknown } | null | undefined)?.data ?? response;
        const connections = extractPlanConnections(member);
        const normalizedLimited = normalizeId(ESSENTIAL_PRICE_ID);
        const normalizedUnlimited = normalizeId(PRO_PRICE_ID);
        let resolved: UsageTier = "FREE";
        let anchor: string | null = null;
        let found = false;
        for (const connection of connections) {
          const status = typeof connection?.status === "string" ? connection.status.toUpperCase() : "";
          if (!ACTIVE_MEMBERSTACK_STATUSES.has(status)) continue;
          const priceIds = collectConnectionPriceIds(connection);
          const candidateAnchor: string | null = anchor ?? pickAnchorDate(connection);
          if (normalizedUnlimited && priceIds.includes(normalizedUnlimited)) {
            resolved = "UNLIMITED";
            anchor = candidateAnchor;
            found = true;
            break;
          }
          if (!found && normalizedLimited && priceIds.includes(normalizedLimited)) {
            resolved = "LIMITED_50K";
            anchor = candidateAnchor;
          }
        }

        if (!cancelled) {
          setTierSource("memberstack");
          setActiveTier(resolved);
          setActiveAnchorIso(anchor);
        }
      } catch (err) {
        console.warn("[pricing] unable to detect active Memberstack plan", err);
        if (!cancelled) {
          setTierSource("unknown");
          setActiveTier(null);
          setActiveAnchorIso(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tierSource !== "memberstack" || !activeTier) return;
    const key = `${activeTier}:${activeAnchorIso ?? ""}`;
    if (syncedKeyRef.current === key) return;
    syncedKeyRef.current = key;
    (async () => {
      try {
        await fetch("/api/billing/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tier: activeTier, anchor: activeAnchorIso }),
        });
      } catch (err) {
        console.warn("[pricing] unable to sync billing cache", err);
      }
    })();
  }, [activeTier, activeAnchorIso, tierSource]);

  const successUrl = () => {
    try {
      return new URL("/account", window.location.origin).toString();
    } catch {
      return window.location.href;
    }
  };

  const cancelUrl = () => {
    try {
      return new URL("/pricing", window.location.origin).toString();
    } catch {
      return window.location.href;
    }
  };

  async function _startCheckout(priceId?: string | null, targetTier?: UsageTier) {
    if (targetTier && activeTier === targetTier) {
      window.alert("Tu as déjà ce plan actif.");
      return;
    }
    if (!priceId) {
      window.alert("Ce plan est temporairement indisponible. Contacte le support pour débloquer l’achat.");
      return;
    }
    try {
      const ms = await getMemberstackClient();
      if (!ms) throw new Error("memberstack_client_unavailable");
      const checkout = resolveCheckout(ms);
      if (!checkout) throw new Error("checkout_method_missing");
      const basePayload = {
        priceId,
        successUrl: successUrl(),
        cancelUrl: cancelUrl(),
      };
      let lastError: unknown = null;
      try {
        await checkout(basePayload);
        return;
      } catch (err) {
        lastError = err;
        if (!shouldRetryWithPriceIds(err)) {
          throw err;
        }
      }
      try {
        await checkout({ ...basePayload, priceIds: [priceId] });
        return;
      } catch (err) {
        lastError = err;
      }
      throw lastError ?? new Error("checkout_failed");
    } catch (err) {
      console.error("[pricing] checkout failed", err);
      const specific = extractErrorMessage(err);
      const code = extractErrorCode(err);
      const alreadyActive = code === "PLAN_ALREADY_ACTIVE" || (specific ? specific.toLowerCase().includes("already") : false);
      if (alreadyActive) {
        try {
          await fetch("/api/billing/refresh", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tier: targetTier ?? activeTier ?? undefined, anchor: activeAnchorIso }),
          });
        } catch {
          // ignore cache refresh errors
        }
        const shouldOpenPortal = window.confirm("Tu as déjà ce plan actif. Veux-tu ouvrir le portail de facturation pour le gérer ?");
        if (shouldOpenPortal) {
          await openBillingPortal();
        }
        return;
      }
      window.alert(specific ?? "Impossible de lancer le paiement. Merci de réessayer ou de contacter le support.");
    }
  }

  async function openBillingPortal() {
    try {
      const ms = await getMemberstackClient();
      if (!ms) throw new Error("memberstack_client_unavailable");
      const portal = resolveBillingPortal(ms);
      if (!portal) throw new Error("billing_portal_unavailable");
      await portal({ returnUrl: successUrl() });
    } catch (err) {
      console.error("[pricing] billing portal failed", err);
      window.alert("Portail de facturation indisponible. Réessaie dans un instant ou contacte le support.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Abonnements</h1>
        <p className="text-sm text-muted-foreground">Choisis un plan pour augmenter ta limite d’upload.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        <PlanCard
          title="Gratuit (version beta)"
          description="Idéal pour commencer"
          priceLabel="0€ / mois"
          features={["5 000 mains / 30 jours"]}
          ctaLabel="Inclus"
          onCta={undefined}
          ctaDisabled
        />
        <PlanCard
          title="Essentiel"
          description="Pour volume régulier"
          priceLabel="20€ / mois"
          features={["50 000 mains / 30 jours"]}
          ctaLabel={activeTier === "LIMITED_50K" ? "Actif" : "Indisponible"}
          onCta={undefined}
          ctaDisabled
          muted
        />
        <PlanCard
          title="Pro"
          description="Pour gros grind"
          priceLabel="30€ / mois"
          features={["150 000 mains / 30 jours"]}
          ctaLabel={activeTier === "UNLIMITED" ? "Actif" : "Indisponible"}
          onCta={undefined}
          ctaDisabled
          muted
        />
      </div>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle>Facturation</CardTitle>
          <CardDescription>Gérer l’abonnement et les paiements depuis le portail sécurisé.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => { void openBillingPortal(); }}
          >
            Ouvrir le portail de facturation
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function PlanCard({ title, description, priceLabel, features, ctaLabel, onCta, ctaDisabled, ctaHint, muted }: {
  title: string;
  description: string;
  priceLabel: string;
  features: string[];
  ctaLabel: string;
  onCta?: () => Promise<void> | void;
  ctaDisabled?: boolean;
  ctaHint?: string;
  muted?: boolean;
}) {
  const cardClassName = `flex h-full flex-col border-border/70 bg-card/70${muted ? " opacity-40 grayscale" : ""}`;
  return (
    <Card className={cardClassName}>
      <CardHeader className="space-y-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-4">
          <div className="text-2xl font-semibold text-foreground">{priceLabel}</div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {features.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <Button className="w-full" disabled={ctaDisabled} onClick={() => { void onCta?.(); }}>{ctaLabel}</Button>
          {ctaHint ? <p className="text-xs text-muted-foreground">{ctaHint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
