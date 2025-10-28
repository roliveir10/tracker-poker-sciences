"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMemberstackClient } from "@/lib/msClient";

type MemberInfo = {
  id?: string;
  pseudo: string;
  language: string;
};

type MemberstackMemberCandidate = {
  id?: unknown;
  data?: Record<string, unknown> | null;
  customFields?: Record<string, unknown> | null;
  fullName?: unknown;
  name?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readFromRecord = (record: Record<string, unknown> | null | undefined, key: string): string | null => {
  if (!record) return null;
  return readString(record[key]);
};

const pickMemberFromResponse = (input: unknown): MemberstackMemberCandidate | null => {
  if (!isRecord(input)) return null;
  if ("data" in input && isRecord((input as { data?: unknown }).data)) {
    return pickMemberFromResponse((input as { data?: unknown }).data);
  }
  return input as MemberstackMemberCandidate;
};

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState<MemberInfo>({ pseudo: "", language: "fr" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ tier: "FREE" | "LIMITED_50K" | "UNLIMITED"; used: number; limit: number | null; remaining: number | null; window?: { start: string; end: string } } | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ms = await getMemberstackClient();
        if (!ms) { setLoading(false); return; }
        const response = await ms.getCurrentMember?.({ useCache: true });
        const candidate = pickMemberFromResponse(response);
        if (!candidate) { if (!cancelled) setMember({ pseudo: "", language: "fr" }); return; }
        const id = readString(candidate.id) ?? undefined;
        const data = isRecord(candidate.data) ? candidate.data : null;
        const customFields = isRecord(candidate.customFields) ? candidate.customFields : null;
        const pseudo =
          readFromRecord(data, "Pseudo") ??
          readFromRecord(data, "pseudo") ??
          readFromRecord(customFields, "Pseudo") ??
          readFromRecord(customFields, "pseudo") ??
          "";
        const language =
          readFromRecord(data, "Language") ??
          readFromRecord(data, "language") ??
          readFromRecord(customFields, "Language") ??
          readFromRecord(customFields, "language") ??
          "fr";
        if (!cancelled) setMember({ id, pseudo, language });
      } catch {
        if (!cancelled) setError("Impossible de charger le compte.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBillingLoading(true);
      try {
        const r = await fetch('/api/billing/usage', { credentials: 'include', cache: 'no-store' });
        if (!r.ok) throw new Error('failed');
        const j = await r.json();
        if (!cancelled) setUsage(j);
      } catch {
        if (!cancelled) setBillingError("Facturation indisponible.");
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const ms = await getMemberstackClient();
      if (!ms) throw new Error("Memberstack non configuré");
      // Met à jour Pseudo et Language comme champs personnalisés
      let updated = false;
      if (ms.updateMember) {
        try {
          await ms.updateMember({ customFields: { Pseudo: member.pseudo, Language: member.language } });
          updated = true;
        } catch {
          // ignore fallback
        }
      }
      if (!updated && ms.updateMemberJSON) {
        try {
          await ms.updateMemberJSON({ Pseudo: member.pseudo, Language: member.language });
          updated = true;
        } catch {
          // ignore fallback failure
        }
      }
      // Optionnel: synchronise User.name côté backend avec le Pseudo
      try {
        if (member.id) {
          await fetch('/api/auth/memberstack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ memberId: member.id, name: member.pseudo }),
            keepalive: true,
          });
        }
      } catch {}
      setSuccess("Enregistré.");
    } catch {
      setError("Échec de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl min-h-[calc(100svh-64px)] flex-col gap-8 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Mon compte</h1>
        <p className="text-sm text-muted-foreground">Gère ton Pseudo et ta langue d’affichage.</p>
      </div>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {billingLoading ? (
            <div className="text-sm text-muted-foreground">Chargement du statut…</div>
          ) : billingError ? (
            <div className="text-sm text-destructive">{billingError}</div>
          ) : usage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">Plan</div>
                <div className="font-medium text-foreground">{usage.tier === 'FREE' ? 'Gratuit' : (usage.tier === 'LIMITED_50K' ? '50k mains / 30j' : 'Illimité')}</div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">Utilisation</div>
                  <div className="font-medium text-foreground">
                    {usage.limit == null ? `${usage.used} mains` : `${usage.used} / ${usage.limit} mains`}
                  </div>
                </div>
                {/* barre de progression */}
                {usage.limit != null && (
                  <div className="h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-2 bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100))}%` }}
                    />
                  </div>
                )}
                {usage.window?.start && usage.window?.end && (
                  <div className="text-xs text-muted-foreground">
                    Fenêtre: {new Date(usage.window.start).toLocaleDateString('fr-FR')} → {new Date(usage.window.end).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => { window.location.href = '/pricing'; }}>Voir les abonnements</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const client = await getMemberstackClient();
                      if (!client?.launchStripeCustomerPortal) return;
                      await client.launchStripeCustomerPortal({ returnUrl: window.location.href });
                    } catch {
                      // ignore portal errors to keep UX smooth
                    }
                  }}
                >
                  Gérer la facturation
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="pseudo">Pseudo</Label>
            <Input id="pseudo" value={member.pseudo} onChange={(e) => setMember((m) => ({ ...m, pseudo: e.target.value }))} placeholder="Ton pseudo" disabled={loading || saving} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="language">Language</Label>
            <Input id="language" value={member.language} onChange={(e) => setMember((m) => ({ ...m, language: e.target.value }))} placeholder="fr | en" disabled={loading || saving} />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          {success && <div className="text-sm text-green-500">{success}</div>}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={loading || saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
