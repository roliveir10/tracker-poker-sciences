"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Street = "preflop" | "flop" | "turn" | "river";

type HandAction = {
  orderNo: number;
  seat: number | null;
  type: "check" | "fold" | "call" | "bet" | "raise" | "push";
  sizeCents: number | null;
  street: Street;
  isAllIn?: boolean | null;
};

type PlayerRow = { seat: number; isHero?: boolean | null; hole?: string | null; startingStackCents?: number | null };

export type ReplayerHand = {
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
  sbCents?: number | null;
  bbCents?: number | null;
};

export function PokerReplayer({
  hand,
  step,
  onPrevAction,
  onNextAction,
  canPrevAction,
  canNextAction,
  onPrevHand,
  onNextHand,
  canPrevHand,
  canNextHand,
}: {
  hand: ReplayerHand;
  step: number;
  onPrevAction: () => void;
  onNextAction: () => void;
  canPrevAction: boolean;
  canNextAction: boolean;
  onPrevHand: () => void;
  onNextHand: () => void;
  canPrevHand: boolean;
  canNextHand: boolean;
}) {
  const actions = useMemo(() => [...(hand.actions || [])].sort((a, b) => a.orderNo - b.orderNo), [hand.actions]);
  const current = step >= 0 && step < actions.length ? actions[step] : null;

  const boardTokens = useMemo(() => {
    const parse = (s?: string | null) => (s ? s.replace(/\[|\]/g, " ").trim().split(/\s+|\|/).filter(Boolean) : []);
    return {
      flop: parse(hand.boardFlop).slice(0, 3),
      turn: parse(hand.boardTurn).slice(0, 4),
      river: parse(hand.boardRiver).slice(0, 5),
      full: parse(hand.board).slice(0, 5),
    };
  }, [hand.board, hand.boardFlop, hand.boardTurn, hand.boardRiver]);

  const visibleBoard = useMemo(() => {
    if (!current) return [] as string[];
    if (current.street === "river") return pickBoard(boardTokens, 5);
    if (current.street === "turn") return pickBoard(boardTokens, 4);
    if (current.street === "flop") return pickBoard(boardTokens, 3);
    return [] as string[];
  }, [current, boardTokens]);

  const streetBetsCents = useMemo(() => computeStreetBets(actions, step), [actions, step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && e.shiftKey) { e.preventDefault(); if (canPrevHand) onPrevHand(); return; }
      if (e.key === "ArrowRight" && e.shiftKey) { e.preventDefault(); if (canNextHand) onNextHand(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); if (canPrevAction) onPrevAction(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); if (canNextAction) onNextAction(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canPrevAction, canNextAction, canPrevHand, canNextHand, onPrevAction, onNextAction, onPrevHand, onNextHand]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Replayer</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onPrevHand} disabled={!canPrevHand} title="Main précédente (⇧+←)">◄ Main</Button>
            <Button variant="secondary" size="sm" onClick={onPrevAction} disabled={!canPrevAction} title="Action précédente (←)">◄</Button>
            <span className="text-xs text-muted-foreground">
              {Math.max(0, Math.min(step + 1, actions.length))}/{actions.length}
            </span>
            <Button variant="secondary" size="sm" onClick={onNextAction} disabled={!canNextAction} title="Action suivante (→)">►</Button>
            <Button variant="secondary" size="sm" onClick={onNextHand} disabled={!canNextHand} title="Main suivante (⇧+→)">Main ►</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mx-auto aspect-[16/9] w-full max-w-none overflow-hidden rounded-lg border border-border/50 bg-black">
            {/* Table background */}
            <Image
              src="/replayer/table_poker.png"
              alt="table"
              fill
              className="absolute inset-0 h-full w-full object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              priority={false}
            />
            {/* Center logo */}
            <Image
              src="/replayer/logo_trefle_blanc.svg"
              alt="logo"
              width={80}
              height={80}
              className="pointer-events-none absolute left-1/2 top-1/2 h-20 -translate-x-1/2 -translate-y-1/2 opacity-20"
            />
            {/* Board */}
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-2">
              {visibleBoard.map((card, idx) => (
                <CardTile key={`${card}-${idx}`} code={card} />
              ))}
            </div>
            {/* Players (avatars, hole cards, dealer) */}
            <TableSeats hand={hand} betsCentsBySeat={streetBetsCents} />
            {/* Labels */}
            <div className="absolute left-2 top-2 rounded bg-white/10 px-2 py-1 text-xs text-white backdrop-blur">
              <span>Blinds: {(hand.sbCents ?? 0)}/{(hand.bbCents ?? 0)} chips</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1 text-sm">
            {actions.map((a, i) => (
              <li key={a.orderNo} className={`rounded px-2 py-1 ${i === step ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}>
                <span className="inline-flex min-w-[62px] capitalize">{a.street}</span>
                <span className="mx-2 font-mono text-xs text-foreground/80">#{a.orderNo}</span>
                <span className="inline-block w-10">{a.seat ?? '-'}</span>
                <span className="inline-block w-16 capitalize">{a.type}</span>
                <span className="inline-block w-20 text-right">{formatChips(a.sizeCents ?? 0)}</span>
                {a.isAllIn ? <span className="ml-2 rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">ALL‑IN</span> : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function TableSeats({ hand, betsCentsBySeat }: { hand: ReplayerHand; betsCentsBySeat: Record<number, number> }) {
  // simple HU/3-max layout positions (percentages relative to container)
  const seats = (hand.players || []).map((p) => p.seat).filter((s): s is number => s != null);
  const uniqueSeats = Array.from(new Set(seats)).sort((a, b) => a - b);
  // map seat index in sorted order to positions
  const positionsByCount: Record<number, Array<{ left: string; top: string }>> = {
    2: [
      { left: '20%', top: '75%' }, // Hero-like bottom-left
      { left: '75%', top: '20%' }, // Opposite
    ],
    3: [
      { left: '20%', top: '78%' },
      { left: '50%', top: '8%' },
      { left: '80%', top: '78%' },
    ],
  };
  const layout = positionsByCount[uniqueSeats.length] || positionsByCount[2];
  const heroSeat = (hand.players.find((p) => p.isHero)?.seat) ?? hand.heroSeat ?? null;
  const bb = hand.bbCents ?? 0;

  function seatIndex(seat: number): number {
    const i = uniqueSeats.indexOf(seat);
    return i >= 0 ? i : 0;
  }

  return (
    <>
      {hand.players.map((p, idx) => {
        const pos = layout[seatIndex(p.seat) % layout.length];
        const isHero = p.isHero || p.seat === heroSeat;
        const betCents = (p.seat != null ? (betsCentsBySeat[p.seat] ?? 0) : 0);
        const betBB = bb > 0 ? betCents / bb : 0;
        return (
          <div key={`seat-${idx}`} className="absolute" style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}>
            {/* avatar */}
            <Image
              src="/replayer/personnages/billy_avatar.webp"
              alt="player"
              width={48}
              height={48}
              className={`h-12 w-12 rounded-full border ${isHero ? 'border-yellow-400' : 'border-white/40'} object-cover shadow`}
            />
            {/* dealer button if applicable */}
            {isDealerForSeat(hand, p.seat) && (
              <Image
                src="/replayer/dealer.webp"
                alt="D"
                width={20}
                height={20}
                className="absolute -right-3 -top-3 h-5 w-5 rounded-full border border-white/50 shadow"
              />
            )}
            {/* bet chips + label */}
            {betBB > 0.01 && (
              <div className="absolute left-1/2 top-[115%] -translate-x-1/2">
                <Image
                  src={chipsAssetForBB(betBB)}
                  alt={`${betBB.toFixed(2)} BB`}
                  width={64}
                  height={32}
                  className="mx-auto h-8 w-auto"
                />
                <div className="mt-1 text-center text-[10px] font-medium text-white/90 drop-shadow">{betBB.toFixed(2)} BB</div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function isDealerForSeat(hand: ReplayerHand, seat: number | null | undefined): boolean {
  if (seat == null) return false;
  // naive heuristic: preflop actions contain blinds; dealer is BTN in 3-max else SB in HU
  const count = (hand.players || []).length;
  const pre = (hand.actions || []).filter((a) => a.street === 'preflop' && a.seat != null);
  if (count === 2) {
    // dealer equals SB
    const sbSeat = hand.sbCents != null ? (pre.find((a) => a.sizeCents === hand.sbCents)?.seat ?? null) : null;
    return sbSeat === seat;
  }
  if (count === 3) {
    const sbSeat = hand.sbCents != null ? (pre.find((a) => a.sizeCents === hand.sbCents)?.seat ?? null) : null;
    const bbSeat = hand.bbCents != null ? (pre.find((a) => a.sizeCents === hand.bbCents && a.seat !== sbSeat)?.seat ?? null) : null;
    const seats = new Set((hand.players || []).map((p) => p.seat));
    const btnSeat = Array.from(seats).find((s) => s !== sbSeat && s !== bbSeat) ?? null;
    return btnSeat === seat;
  }
  return false;
}

function computeStreetBets(actions: HandAction[], step: number): Record<number, number> {
  if (!Array.isArray(actions) || actions.length === 0 || step < 0) return {};
  const sorted = [...actions].sort((a, b) => a.orderNo - b.orderNo);
  const current = step < sorted.length ? sorted[step] : sorted[sorted.length - 1];
  const street = current.street;
  const investedOnStreet: Record<number, number> = {};
  for (const a of sorted) {
    if (a.street !== street) continue;
    if (a.orderNo > current.orderNo) break;
    if (a.seat == null) continue;
    const prev = investedOnStreet[a.seat] ?? 0;
    if (a.type === 'call' || a.type === 'bet') {
      investedOnStreet[a.seat] = prev + Math.max(0, a.sizeCents ?? 0);
    } else if (a.type === 'raise' || a.type === 'push') {
      const to = Math.max(0, a.sizeCents ?? 0);
      investedOnStreet[a.seat] = Math.max(prev, to);
    }
  }
  return investedOnStreet;
}

function chipsAssetForBB(bb: number): string {
  const v = Math.max(0, bb);
  if (v < 0.75) return '/replayer/jetons/0.5bb.webp';
  if (v < 1.5) return '/replayer/jetons/1bb.webp';
  if (v < 2.5) return '/replayer/jetons/2bb.webp';
  if (v < 3.5) return '/replayer/jetons/3bb.webp';
  if (v < 4.5) return '/replayer/jetons/4bb.webp';
  return '/replayer/jetons/5-10bb.webp';
}

function pickBoard(tokens: { flop: string[]; turn: string[]; river: string[]; full: string[] }, n: number): string[] {
  if (tokens.full.length >= n) return tokens.full.slice(0, n);
  if (n === 5 && tokens.river.length >= 5) return tokens.river.slice(0, 5);
  if (n === 4 && tokens.turn.length >= 4) return tokens.turn.slice(0, 4);
  if (n === 3 && tokens.flop.length >= 3) return tokens.flop.slice(0, 3);
  if (n === 5 && tokens.turn.length >= 4) return tokens.turn; // fallback
  if (n === 4 && tokens.flop.length >= 3) return tokens.flop; // fallback
  return tokens.flop.slice(0, Math.min(3, tokens.flop.length));
}

function CardTile({ code }: { code: string }) {
  const { rank, suit } = parseCard(code);
  const isRed = suit === 'h' || suit === 'd';
  const suitAsset = suit === 'd' ? '/replayer/symbol cards/carreau.svg'
    : suit === 'h' ? '/replayer/symbol cards/coeur.svg'
    : suit === 's' ? '/replayer/symbol cards/pique.svg'
    : '/replayer/symbol cards/trefle.svg';
  return (
    <div className="flex h-16 w-11 flex-col items-center justify-between rounded-md border border-white/30 bg-white/95 p-0.5 text-[11px] shadow">
      <div className={`font-bold ${isRed ? 'text-red-600' : 'text-black'}`}>{rank}</div>
      <Image src={suitAsset} alt={suit} width={20} height={20} className="h-5 w-5 opacity-90" />
      <div className={`font-bold ${isRed ? 'text-red-600' : 'text-black'}`}>{rank}</div>
    </div>
  );
}

function parseCard(s: string): { rank: string; suit: 's' | 'h' | 'd' | 'c' } {
  const t = s.trim();
  const rank = t[0]?.toUpperCase() ?? '?';
  const suit = (t[1]?.toLowerCase() ?? 's') as 's' | 'h' | 'd' | 'c';
  return { rank, suit };
}

function formatChips(v: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.max(0, v));
}
