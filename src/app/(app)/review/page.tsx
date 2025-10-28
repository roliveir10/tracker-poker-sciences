"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

type Period = "today" | "yesterday" | "this-week" | "this-month" | "custom" | null;
type Phase = "preflop" | "postflop" | undefined;

type HandAction = {
  orderNo: number;
  seat: number | null;
  type: "check" | "fold" | "call" | "bet" | "raise" | "push";
  sizeCents: number | null;
  street: "preflop" | "flop" | "turn" | "river";
  isAllIn?: boolean | null;
};

type PlayerRow = { seat: number; isHero?: boolean | null; hole?: string | null; startingStackCents?: number | null };

type BatchHand = {
  id: string;
  playedAt: string | null;
  evRealizedCents: number | null;
  evAllInAdjCents: number | null;
  totalPotCents: number | null;
  mainPotCents: number | null;
  board: string | null;
  boardFlop: string | null;
  boardTurn: string | null;
  boardRiver: string | null;
  actions: HandAction[];
  players: PlayerRow[];
  heroSeat?: number | null;
  winnerSeat?: number | null;
  // champs ajoutés côté API batch
  tournamentId?: string | null;
  sbCents?: number | null;
  bbCents?: number | null;
};

type ScoredHand = {
  hand: BatchHand;
  deltaAdj: number; // ΔEV adj (chips)
  resultVsAdj: number; // (realized - adjusted)
  potCents: number; // estimation pot
  categories: string[]; // tags heuristiques
  effBB: number | null;
  role: string | null; // BU/SB/BB/HU-SB/HU-BB si détectable
  keyStreet: "preflop" | "flop" | "turn" | "river" | null;
};

export default function ReviewPage() {
  const [period, setPeriod] = useState<Period>("this-week");
  const [phase, setPhase] = useState<Phase>("postflop");
  const [buyIns, setBuyIns] = useState<number[]>([]);
  const [buyInOptions, setBuyInOptions] = useState<number[]>([]);
  const [position, setPosition] = useState<"hu" | "3max" | undefined>(undefined);
  const [huRoles, setHuRoles] = useState<Array<'sb' | 'bb'>>([]);
  const [m3Roles, setM3Roles] = useState<Array<'bu' | 'sb' | 'bb'>>([]);
  const [effMin, setEffMin] = useState<string>("");
  const [effMax, setEffMax] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ScoredHand[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"deltaAdj" | "gap" | "pot">("deltaAdj");
  const [threshold, setThreshold] = useState<number>(50); // chips

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (period && period !== "custom") qs.set("period", period);
        if (phase) qs.set("phase", phase);
        const res = await fetch(`/api/tournaments/buyins${qs.size ? `?${qs.toString()}` : ""}`, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        const list: number[] = Array.isArray(data.buyIns) ? data.buyIns : [];
        setBuyInOptions(list);
      } catch {
        // ignore options fetch errors
      }
    })();
    return () => controller.abort();
  }, [period, phase]);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "500");
      if (period && period !== "custom") qs.set("period", period);
      if (phase) qs.set("phase", phase);
      for (const b of buyIns) qs.append("buyIns", String(b));
      if (!reset && cursor) qs.set("cursor", cursor);
      if (position) qs.set("position", position);
      for (const r of huRoles) qs.append("huRole", r);
      for (const r of m3Roles) qs.append("m3Role", r);
      if (effMin) qs.set("effMin", String(Number(effMin)));
      if (effMax) qs.set("effMax", String(Number(effMax)));
      const idsRes = await fetch(`/api/hands/ids?${qs.toString()}`, { cache: "no-store" });
      if (!idsRes.ok) throw new Error("ids_failed");
      const { ids, nextCursor } = await idsRes.json();
      if (!Array.isArray(ids) || ids.length === 0) {
        if (reset) { setItems([]); setCursor(null); }
        setLoading(false);
        return;
      }
      const batchRes = await fetch("/api/hands/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!batchRes.ok) throw new Error("batch_failed");
      const j = await batchRes.json();
      const hands: BatchHand[] = Array.isArray(j?.hands) ? j.hands : [];
      const scored = hands.map(scoreHand).sort(sorter(sortBy, threshold));
      setItems((prev) => reset ? scored : [...prev, ...scored]);
      setCursor(nextCursor ?? null);
    } catch {
      setError("Impossible de charger les mains à revoir.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, phase, buyIns.join(","), sortBy, threshold, position, huRoles.join(','), m3Roles.join(','), effMin, effMax]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Mains à revoir</h1>
        <p className="text-sm text-muted-foreground">Spins uniquement. Classement par impact EV et écart résultat.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Période, phase et buy-ins (optionnels)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Période</span>
            <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-1">
              <Button variant={period === "today" ? "default" : "secondary"} size="sm" type="button" onClick={() => setPeriod("today")}>Today</Button>
              <Button variant={period === "this-week" ? "default" : "secondary"} size="sm" type="button" onClick={() => setPeriod("this-week")}>This week</Button>
              <Button variant={period === "this-month" ? "default" : "secondary"} size="sm" type="button" onClick={() => setPeriod("this-month")}>This month</Button>
              <Button variant={period === null ? "default" : "secondary"} size="sm" type="button" onClick={() => setPeriod(null)}>All-Time</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Position</span>
            <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-1">
              <Button variant={position === undefined ? "default" : "secondary"} size="sm" type="button" onClick={() => { setPosition(undefined); setHuRoles([]); setM3Roles([]); }}>All</Button>
              <Button variant={position === "hu" ? "default" : "secondary"} size="sm" type="button" onClick={() => { setPosition("hu"); setM3Roles([]); }}>HU</Button>
              <Button variant={position === "3max" ? "default" : "secondary"} size="sm" type="button" onClick={() => { setPosition("3max"); setHuRoles([]); }}>3-max</Button>
            </div>
            {position === 'hu' && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={huRoles.includes('sb')} onChange={(e) => setHuRoles((prev) => e.target.checked ? Array.from(new Set([...prev, 'sb'])) : prev.filter((x) => x !== 'sb'))} />
                  <span>SB</span>
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={huRoles.includes('bb')} onChange={(e) => setHuRoles((prev) => e.target.checked ? Array.from(new Set([...prev, 'bb'])) : prev.filter((x) => x !== 'bb'))} />
                  <span>BB</span>
                </label>
              </div>
            )}
            {position === '3max' && (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={m3Roles.includes('bu')} onChange={(e) => setM3Roles((prev) => e.target.checked ? Array.from(new Set([...prev, 'bu'])) : prev.filter((x) => x !== 'bu'))} />
                  <span>BU</span>
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={m3Roles.includes('sb')} onChange={(e) => setM3Roles((prev) => e.target.checked ? Array.from(new Set([...prev, 'sb'])) : prev.filter((x) => x !== 'sb'))} />
                  <span>SB</span>
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={m3Roles.includes('bb')} onChange={(e) => setM3Roles((prev) => e.target.checked ? Array.from(new Set([...prev, 'bb'])) : prev.filter((x) => x !== 'bb'))} />
                  <span>BB</span>
                </label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stack eff. (BB)</span>
            <div className="flex items-center gap-2">
              <Input id="eff-min" type="number" inputMode="decimal" placeholder="min" className="w-24" value={effMin} onChange={(e) => setEffMin(e.target.value)} />
              <Input id="eff-max" type="number" inputMode="decimal" placeholder="max" className="w-24" value={effMax} onChange={(e) => setEffMax(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Phase</span>
            <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-1">
              <Button variant={phase === undefined ? "default" : "secondary"} size="sm" type="button" onClick={() => setPhase(undefined)}>All</Button>
              <Button variant={phase === "preflop" ? "default" : "secondary"} size="sm" type="button" onClick={() => setPhase("preflop")}>Preflop</Button>
              <Button variant={phase === "postflop" ? "default" : "secondary"} size="sm" type="button" onClick={() => setPhase("postflop")}>Postflop</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Buy-in</span>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="ex: 1, 5, 10"
                className="w-56"
                value={buyIns.join(", ")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const list = raw.split(/,\s*/).map((t) => Number(t)).filter((n) => Number.isFinite(n)).map((eur) => Math.round(eur * 100));
                  setBuyIns(list);
                }}
              />
              <span className="text-xs text-muted-foreground">Options: {buyInOptions.map((c) => (c/100).toFixed(Number.isInteger(c/100) ? 0 : 2)).join(", ")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tri</span>
            <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-1">
              <Button variant={sortBy === "deltaAdj" ? "default" : "secondary"} size="sm" type="button" onClick={() => setSortBy("deltaAdj")}>EV adj</Button>
              <Button variant={sortBy === "gap" ? "default" : "secondary"} size="sm" type="button" onClick={() => setSortBy("gap")}>Écart</Button>
              <Button variant={sortBy === "pot" ? "default" : "secondary"} size="sm" type="button" onClick={() => setSortBy("pot")}>Pot</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Seuil EV (chips)</span>
            <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 0)} className="w-24" />
          </div>
          <div className="ml-auto">
            <Button type="button" variant="secondary" onClick={() => load(true)} disabled={loading}>Rafraîchir</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Spots à prioriser</CardTitle>
          <CardDescription>Triés selon votre critère, avec catégories heuristiques.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Eff BB</TableHead>
                <TableHead>Street</TableHead>
                <TableHead>Pot</TableHead>
                <TableHead>ΔEV adj</TableHead>
                <TableHead>Écart</TableHead>
                <TableHead>Catégories</TableHead>
                <TableHead className="text-right">Lien</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.hand.id}>
                  <TableCell>{it.hand.playedAt ? new Date(it.hand.playedAt).toLocaleString("fr-FR") : "—"}</TableCell>
                  <TableCell>{it.role ?? "—"}</TableCell>
                  <TableCell>{it.effBB != null ? it.effBB.toFixed(1) : "—"}</TableCell>
                  <TableCell className="capitalize">{it.keyStreet ?? "—"}</TableCell>
                  <TableCell>{formatChips(it.potCents)}</TableCell>
                  <TableCell className={it.deltaAdj < 0 ? "text-red-500" : undefined}>{formatChips(it.deltaAdj)}</TableCell>
                  <TableCell>{formatChips(it.resultVsAdj)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {it.categories.length === 0 ? <span>—</span> : it.categories.map((c) => (
                        <span key={c} className="rounded bg-muted px-2 py-0.5">{c}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {it.hand.tournamentId ? (
                      <Link className="underline" href={`/tournaments/${it.hand.tournamentId}/replay/${it.hand.id}`}>Replayer</Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {items.length === 0 && !loading && (
            <div className="mt-6 rounded-md border border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">Aucune main à afficher.</div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{items.length} lignes</div>
            <Button type="button" variant="secondary" disabled={loading || !cursor} onClick={() => load(false)}>
              {loading ? "Chargement…" : cursor ? "Charger plus" : "Fin"}
            </Button>
          </div>
          {loading && (
            <div className="mt-3 text-xs text-muted-foreground">Chargement en cours…</div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function scoreHand(h: BatchHand): ScoredHand {
  const deltaAdj = (h.evAllInAdjCents ?? h.evRealizedCents ?? 0);
  const resultVsAdj = (h.evRealizedCents ?? 0) - (h.evAllInAdjCents ?? 0);
  const potCents = h.totalPotCents ?? h.mainPotCents ?? sumActions(h.actions);
  const role = detectRole(h);
  const effBB = computeEffBB(h);
  const keyStreet = detectKeyStreet(h);
  const categories: string[] = [];
  if (deltaAdj <= -50) categories.push("Grosse perte EV");
  if (isMultiwayPostflop(h)) categories.push("Multiway postflop");
  if (hasBigRiverOrAllIn(h, potCents)) categories.push("Gros sizing/AI");
  return { hand: h, deltaAdj, resultVsAdj, potCents, categories, effBB, role, keyStreet };
}

function sorter(kind: "deltaAdj" | "gap" | "pot", threshold: number) {
  return (a: ScoredHand, b: ScoredHand) => {
    // Prioriser d'abord les mains sous le seuil EV négatif
    const aBad = a.deltaAdj <= -Math.abs(threshold);
    const bBad = b.deltaAdj <= -Math.abs(threshold);
    if (aBad !== bBad) return aBad ? -1 : 1;
    if (kind === "deltaAdj") return a.deltaAdj - b.deltaAdj; // plus négatif en premier
    if (kind === "gap") return Math.abs(b.resultVsAdj) - Math.abs(a.resultVsAdj);
    return b.potCents - a.potCents;
  };
}

function sumActions(actions: HandAction[] | undefined | null): number {
  if (!Array.isArray(actions)) return 0;
  let totals: Record<number, number> = {};
  let street: "preflop" | "flop" | "turn" | "river" = "preflop";
  for (const a of [...actions].sort((x, y) => x.orderNo - y.orderNo)) {
    if (a.street !== street) { totals = {}; street = a.street; }
    if (a.seat == null) continue;
    const prev = totals[a.seat] ?? 0;
    if (a.type === "call" || a.type === "bet") totals[a.seat] = prev + Math.max(0, a.sizeCents ?? 0);
    else if (a.type === "raise" || a.type === "push") {
      const to = Math.max(0, a.sizeCents ?? 0);
      totals[a.seat] = Math.max(prev, to);
    }
  }
  return Object.values(totals).reduce((s, v) => s + v, 0);
}

function detectKeyStreet(h: BatchHand): ScoredHand["keyStreet"] {
  const hasRiver = h.actions?.some((a) => a.street === "river");
  const hasTurn = h.actions?.some((a) => a.street === "turn");
  const hasFlop = h.actions?.some((a) => a.street === "flop");
  if (hasRiver) return "river";
  if (hasTurn) return "turn";
  if (hasFlop) return "flop";
  return "preflop";
}

function isMultiwayPostflop(h: BatchHand): boolean {
  const flopActs = (h.actions || []).filter((a) => a.street === "flop" && a.seat != null);
  const seats = new Set(flopActs.map((a) => a.seat as number));
  return seats.size >= 3; // 3+ sièges actifs au flop
}

function hasBigRiverOrAllIn(h: BatchHand, potCents: number): boolean {
  const riverActs = (h.actions || []).filter((a) => a.street === "river" && a.seat != null);
  const big = riverActs.some((a) => (a.type === "bet" || a.type === "raise" || a.type === "push") && (a.isAllIn || (Math.max(0, a.sizeCents ?? 0) >= 0.6 * potCents)));
  const anyAllIn = (h.actions || []).some((a) => a.isAllIn);
  return big || anyAllIn;
}

function computeEffBB(h: BatchHand): number | null {
  const bb = h.bbCents ?? null;
  if (!bb || bb <= 0) return null;
  const heroSeat = (h.players.find((p) => p.isHero)?.seat) ?? (h.heroSeat ?? null);
  if (heroSeat == null) return null;
  const stacks = (h.players || []).map((p) => ({ seat: p.seat, stack: p.startingStackCents ?? 0 })).filter((p) => (p.stack ?? 0) > 0);
  const heroStart = stacks.find((p) => p.seat === heroSeat)?.stack ?? 0;
  const others = stacks.filter((p) => p.seat !== heroSeat).map((p) => p.stack);
  if (heroStart <= 0 || others.length === 0) return null;
  const maxOther = Math.max(...others);
  const effChips = others.length === 1 ? Math.min(heroStart, others[0]!) : Math.min(heroStart, maxOther);
  return effChips / bb;
}

function detectRole(h: BatchHand): string | null {
  const pre = (h.actions || []).filter((a) => a.street === "preflop" && a.seat != null).sort((a, b) => a.orderNo - b.orderNo);
  const sbSeat = h.sbCents != null ? (pre.find((a) => a.sizeCents === h.sbCents)?.seat ?? null) : null;
  const bbSeat = h.bbCents != null ? (pre.find((a) => a.sizeCents === h.bbCents && a.seat !== sbSeat)?.seat ?? null) : null;
  const heroSeat = (h.players.find((p) => p.isHero)?.seat) ?? (h.heroSeat ?? null);
  if (heroSeat == null) return null;
  const seats = new Set((h.players || []).map((p) => p.seat));
  if (seats.size === 2) {
    if (sbSeat == null) return null;
    return heroSeat === sbSeat ? "HU-SB" : "HU-BB";
  }
  if (seats.size === 3) {
    if (sbSeat == null || bbSeat == null) return null;
    const btnSeat = Array.from(seats).find((s) => s !== sbSeat && s !== bbSeat) ?? null;
    if (heroSeat === btnSeat) return "BU";
    if (heroSeat === sbSeat) return "SB";
    if (heroSeat === bbSeat) return "BB";
  }
  return null;
}

function formatChips(value: number | null | undefined) {
  const v = value ?? 0;
  return new Intl.NumberFormat("fr-FR").format(v);
}
