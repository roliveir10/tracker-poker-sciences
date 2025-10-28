"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PokerReplayer, type ReplayerHand } from "@/components/replayer/PokerReplayer";

type HandRow = { id: string; handNo: string | null; playedAt: string | null };

export default function ReplayPage() {
  const params = useParams<{ id: string; handId: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const tournamentId = params?.id as string;
  const initialHandId = params?.handId as string;
  const [order, setOrder] = useState<HandRow[]>([]);
  const [currentId, setCurrentId] = useState<string>(initialHandId);
  const [hands, setHands] = useState<Record<string, ReplayerHand>>({});
  const [step, setStep] = useState<number>(() => {
    const s = Number(search?.get('step'));
    return Number.isFinite(s) && s >= 0 ? Math.floor(s) : 0;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const idx = useMemo(() => order.findIndex((h) => h.id === currentId), [order, currentId]);
  const prevId = idx > 0 ? order[idx - 1]?.id : null;
  const nextId = idx >= 0 && idx + 1 < order.length ? order[idx + 1]?.id : null;
  const hand = hands[currentId] || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/tournaments/${tournamentId}/hands`, { cache: 'no-store' });
        if (!r.ok) throw new Error('order_failed');
        const items: Array<{ id: string; handNo: string | null; playedAt: string | null; createdAt?: string | null }> = await r.json();
        // Tri stable par playedAt, handNo, createdAt si dispo
        items.sort((a, b) => {
          const ta = a.playedAt ? new Date(a.playedAt).getTime() : 0;
          const tb = b.playedAt ? new Date(b.playedAt).getTime() : 0;
          if (ta !== tb) return ta - tb;
          const ha = a.handNo || '';
          const hb = b.handNo || '';
          if (ha !== hb) return ha < hb ? -1 : 1;
          const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return ca - cb;
        });
        if (!cancelled) setOrder(items);
      } catch {
        if (!cancelled) setError("Impossible de charger l'ordre des mains.");
      }
    })();
    return () => { cancelled = true; };
  }, [tournamentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentId) return;
      setLoading(true);
      setError(null);
      try {
        const ids = [currentId, prevId, nextId].filter(Boolean);
        const r = await fetch('/api/hands/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
        if (!r.ok) throw new Error('batch_failed');
        const j = await r.json();
        const list: ReplayerHand[] = Array.isArray(j?.hands) ? j.hands : [];
        if (!cancelled) {
          setHands((prev) => {
            const cp = { ...prev };
            for (const h of list) cp[h.id] = h;
            return cp;
          });
        }
      } catch {
        if (!cancelled) setError('Impossible de charger la main.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentId, prevId, nextId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('step', String(step));
    window.history.replaceState({}, '', url.toString());
  }, [step]);

  if (error) return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <Card className="border-destructive/40 bg-destructive/10 text-destructive">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-sm font-semibold text-destructive">Erreur</CardTitle>
        </CardHeader>
        <CardContent>{error}</CardContent>
      </Card>
    </main>
  );

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Replayer</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.push(`/tournaments/${tournamentId}`)}>Retour Tournoi</Button>
        </div>
      </div>

      {(!hand || loading) ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Chargement…</CardTitle></CardHeader>
          <CardContent><div className="h-64 animate-pulse rounded-md bg-muted" /></CardContent>
        </Card>
      ) : (
        <PokerReplayer
          hand={hand}
          step={Math.max(0, Math.min(step, (hand.actions || []).length - 1))}
          onPrevAction={() => setStep((s) => Math.max(0, s - 1))}
          onNextAction={() => setStep((s) => Math.min((hand.actions || []).length - 1, s + 1))}
          canPrevAction={step > 0}
          canNextAction={step < (hand.actions || []).length - 1}
          onPrevHand={() => { if (prevId) { setCurrentId(prevId); setStep(0); router.replace(`/tournaments/${tournamentId}/replay/${prevId}?step=0`); } }}
          onNextHand={() => { if (nextId) { setCurrentId(nextId); setStep(0); router.replace(`/tournaments/${tournamentId}/replay/${nextId}?step=0`); } }}
          canPrevHand={!!prevId}
          canNextHand={!!nextId}
        />
      )}
    </main>
  );
}

