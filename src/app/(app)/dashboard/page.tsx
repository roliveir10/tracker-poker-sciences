"use client";

import { useEffect, useState } from 'react';
import { EvCurveChart } from '@/components/ev-curve-chart';
import { BankrollCurveChart } from '@/components/bankroll-curve-chart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';

type Stats = {
	tournaments: number;
	hands: number;
	totalBuyInCents: number;
	totalRakeCents: number;
	totalProfitCents: number;
	roiPct: number;
	itmPct: number;
	chipEvPerGame: number;
};

type SavedFilters = {
	period: 'today' | 'yesterday' | 'this-week' | 'this-month' | 'custom' | null;
	dateFrom: string | undefined;
	dateTo: string | undefined;
	timeFrom: string | undefined;
	timeTo: string | undefined;
	customMode: 'since' | 'before' | 'betweenDates' | 'betweenHours' | 'onDate';
	chartView: 'chips' | 'bankroll';
	moreOpen: boolean;
	buyIns: number[];
	huRoles: Array<'sb' | 'bb'>;
	m3Roles: Array<'bu' | 'sb' | 'bb'>;
	position: 'hu' | '3max' | undefined;
	effMin: string | undefined;
	effMax: string | undefined;
	phase: 'preflop' | 'postflop' | undefined;
};

function safeLocalStorage() {
	if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
		return null;
	}
	return window.localStorage;
}

function readSavedFilters(key: string) {
	try {
		const storage = safeLocalStorage();
		const raw = storage ? storage.getItem(key) : null;
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function writeSavedFilters(key: string, data: unknown) {
	try {
		const storage = safeLocalStorage();
		if (storage) storage.setItem(key, JSON.stringify(data));
	} catch {
		// ignore
	}
}

export default function DashboardPage() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [error, setError] = useState<string | null>(null);
	const FILTERS_STORAGE_KEY = 'dashboard:filters:v1';

	function readSaved() {
		const stored = readSavedFilters(FILTERS_STORAGE_KEY);
		if (!stored || typeof stored !== 'object') return null;
		return stored as SavedFilters;
	}

	const saved = readSaved();
	const [period, setPeriod] = useState<'today' | 'yesterday' | 'this-week' | 'this-month' | 'custom' | null>(() => saved?.period ?? 'today');
	const [dateFrom, setDateFrom] = useState<string | undefined>(() => saved?.dateFrom ?? undefined);
	const [dateTo, setDateTo] = useState<string | undefined>(() => saved?.dateTo ?? undefined);
	const [timeFrom, setTimeFrom] = useState<string | undefined>(() => saved?.timeFrom ?? undefined);
	const [timeTo, setTimeTo] = useState<string | undefined>(() => saved?.timeTo ?? undefined);
	const [moreOpen, setMoreOpen] = useState<boolean>(() => saved?.moreOpen ?? false);
	const [customMode, setCustomMode] = useState<'since' | 'before' | 'betweenDates' | 'betweenHours' | 'onDate'>(() => (saved?.customMode === 'onDate' ? 'onDate' : (saved?.customMode ?? 'since')));
	const [draftDateFrom, setDraftDateFrom] = useState<string>('');
	const [draftDateTo, setDraftDateTo] = useState<string>('');
	const [draftTimeFrom, setDraftTimeFrom] = useState<string>('');
	const [draftTimeTo, setDraftTimeTo] = useState<string>('');
	const [chartView, setChartView] = useState<'chips' | 'bankroll'>(() => saved?.chartView ?? 'chips');

	const parseStoredArray = <T,>(value: unknown, guard: (v: unknown) => v is T): T[] => {
		if (!Array.isArray(value)) return [];
		return value.filter(guard);
	};

	const parseStoredNumberArray = (value: unknown): number[] => parseStoredArray<number>(value, (v): v is number => typeof v === 'number' && Number.isFinite(v));
	const parseStoredHuRoles = (value: unknown): Array<'sb' | 'bb'> => parseStoredArray<'sb' | 'bb'>(value, (v): v is 'sb' | 'bb' => v === 'sb' || v === 'bb');
	const parseStoredM3Roles = (value: unknown): Array<'bu' | 'sb' | 'bb'> => parseStoredArray<'bu' | 'sb' | 'bb'>(value, (v): v is 'bu' | 'sb' | 'bb' => v === 'bu' || v === 'sb' || v === 'bb');

	const savedBuyIns = parseStoredNumberArray(saved?.buyIns);
	const savedHuRoles = parseStoredHuRoles(saved?.huRoles);
	const savedM3Roles = parseStoredM3Roles(saved?.m3Roles);

	const [buyIns, setBuyIns] = useState<number[]>(() => savedBuyIns);
	const [buyInOptions, setBuyInOptions] = useState<number[]>([]);
	const [buyInOpen, setBuyInOpen] = useState<boolean>(false);
	const [draftBuyIns, setDraftBuyIns] = useState<number[]>([]);
	const [effOpen, setEffOpen] = useState<boolean>(false);
const [effMin, setEffMin] = useState<string>(() => saved?.effMin ?? '');
const [effMax, setEffMax] = useState<string>(() => saved?.effMax ?? '');
const [draftEffMin, setDraftEffMin] = useState<string>('');
const [draftEffMax, setDraftEffMax] = useState<string>('');
const [position, setPosition] = useState<'hu' | '3max' | undefined>(() => (saved?.position === 'hu' || saved?.position === '3max') ? saved.position : undefined);
const [huRoles, setHuRoles] = useState<Array<'sb' | 'bb'>>(() => savedHuRoles);
const [m3Roles, setM3Roles] = useState<Array<'bu' | 'sb' | 'bb'>>(() => savedM3Roles);
const [posOpen, setPosOpen] = useState<boolean>(false);
const [draftPosition, setDraftPosition] = useState<'hu' | '3max' | undefined>(undefined);
const [draftHuRoles, setDraftHuRoles] = useState<Array<'sb' | 'bb'>>([]);
const [draftM3Roles, setDraftM3Roles] = useState<Array<'bu' | 'sb' | 'bb'>>([]);
const [phase, setPhase] = useState<'preflop' | 'postflop' | undefined>(() => (saved?.phase === 'preflop' || saved?.phase === 'postflop') ? saved.phase : undefined);
const [othersOpen, setOthersOpen] = useState<boolean>(false);
const [draftPhase, setDraftPhase] = useState<'preflop' | 'postflop' | undefined>(undefined);

	// Persist filters whenever they change
	useEffect(() => {
		try {
			const data = {
				period,
				dateFrom: dateFrom || undefined,
				dateTo: dateTo || undefined,
				timeFrom: timeFrom || undefined,
				timeTo: timeTo || undefined,
				customMode,
				chartView,
				moreOpen,
				buyIns: buyIns.length > 0 ? buyIns : undefined,
				position: position ?? undefined,
				huRoles: huRoles.length > 0 ? huRoles : undefined,
				m3Roles: m3Roles.length > 0 ? m3Roles : undefined,
				effMin: effMin || undefined,
				effMax: effMax || undefined,
				phase: phase ?? undefined,
			};
			writeSavedFilters(FILTERS_STORAGE_KEY, data);
		} catch {
			// ignore
		}
	}, [period, dateFrom, dateTo, timeFrom, timeTo, customMode, chartView, moreOpen, buyIns, position, huRoles, m3Roles, effMin, effMax, phase]);

	// Charger les options de buy-in selon la même plage de dates/heures
	useEffect(() => {
		const controller = new AbortController();
		(async () => {
			try {
				const qs = new URLSearchParams();
				if (period && period !== 'custom') qs.set('period', period);
				if (period === 'custom') {
					if (dateFrom) qs.set('dateFrom', toIsoDateTime(dateFrom, timeFrom));
					if (dateTo) qs.set('dateTo', toIsoDateTime(dateTo, timeTo));
					if (timeFrom) qs.set('hoursFrom', timeFrom);
					if (timeTo) qs.set('hoursTo', timeTo);
				}
				const res = await fetch(`/api/tournaments/buyins${qs.size ? `?${qs.toString()}` : ''}`, { signal: controller.signal, cache: 'no-store' });
				if (!res.ok) throw new Error('failed');
					const data = await res.json();
				const list: number[] = Array.isArray(data.buyIns) ? data.buyIns : [];
				setBuyInOptions(list);
			} catch {
				// ignore
			}
		})();
		return () => controller.abort();
	}, [period, dateFrom, dateTo, timeFrom, timeTo]);

	const rangeLabel = (() => {
		if (period === 'today') return 'Today';
		if (period === 'yesterday') return 'Yesterday';
		if (period === 'this-week') return 'This week';
		if (period === 'this-month') return 'This month';
		if (period === 'custom') {
			if (customMode === 'since' && dateFrom) return `Since ${dateFrom}`;
			if (customMode === 'before' && dateTo) return `Before ${dateTo}`;
			if (customMode === 'onDate' && dateFrom && dateTo && dateFrom === dateTo) return `${dateFrom}`;
			if (customMode === 'betweenDates' && dateFrom && dateTo) return `${dateFrom} → ${dateTo}`;
			if (customMode === 'betweenHours' && timeFrom && timeTo) return `${timeFrom}–${timeTo}`;
			return 'Custom';
		}
		return 'Date';
	})();

	useEffect(() => {
    const qs = new URLSearchParams();
    if (period && period !== 'custom') qs.set('period', period);
    if (period === 'custom') {
      if (dateFrom) qs.set('dateFrom', toIsoDateTime(dateFrom, timeFrom));
      if (dateTo) qs.set('dateTo', toIsoDateTime(dateTo, timeTo));
      if (timeFrom) qs.set('hoursFrom', timeFrom);
      if (timeTo) qs.set('hoursTo', timeTo);
    }
    if (buyIns.length > 0) for (const b of buyIns) qs.append('buyIns', String(b));
    if (position) qs.set('position', position);
    if (huRoles.length > 0) for (const r of huRoles) qs.append('huRole', r);
    if (m3Roles.length > 0) for (const r of m3Roles) qs.append('m3Role', r);
    if (effMin) qs.set('effMin', String(Number(effMin)));
    if (effMax) qs.set('effMax', String(Number(effMax)));
    if (phase) qs.set('phase', phase);
    const url = `/api/stats${qs.size ? `?${qs.toString()}` : ''}`;
    fetch(url)
			.then(async (r) => {
				if (!r.ok) throw new Error('failed');
				return r.json();
			})
			.then(setStats)
			.catch(() => setError('Unable to load statistics.'));
  }, [period, dateFrom, dateTo, timeFrom, timeTo, buyIns, position, huRoles, m3Roles, effMin, effMax, phase]);

  function toIsoDateTime(d?: string, t?: string) {
    if (!d && !t) return '';
    const date = d ?? new Date().toISOString().slice(0, 10);
    const time = t ?? '00:00';
    // Treat as UTC for backend simplicity
    return `${date}T${time}:00.000Z`;
  }

	return (
		<main className="mx-auto flex h-[calc(100svh-64px)] w-full max-w-5xl flex-col gap-6 px-4 py-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
				<p className="text-sm text-muted-foreground">Track your Spin &amp; Go performance, EV and ROI at a glance.</p>
			</div>
			{error && (
				<Card className="border-destructive/40 bg-destructive/10 text-destructive">
					<CardHeader className="space-y-1.5">
						<CardTitle className="text-sm font-semibold text-destructive">An error occurred</CardTitle>
						<CardDescription className="text-destructive/80">
							{error}
						</CardDescription>
					</CardHeader>
				</Card>
			)}
			{stats && (
				<section className="flex flex-1 flex-col gap-6 overflow-hidden">
						<div className="grid flex-shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<Kpi label="Tournaments" value={stats.tournaments} />
							<Kpi label="CEV" value={formatChips(stats.chipEvPerGame)} />
						<Kpi
							label="Profit"
							value={formatEuros(stats.totalProfitCents)}
							valueClassName={stats.totalProfitCents < 0 ? 'text-red-500' : undefined}
							valueStyle={stats.totalProfitCents > 0 ? { color: '#22c55e' } : undefined}
						/>
						<Kpi
							label="ROI"
							value={`${stats.roiPct.toFixed(1)}%`}
							valueClassName={stats.roiPct < 0 ? 'text-red-500' : undefined}
							valueStyle={stats.roiPct > 0 ? { color: '#22c55e' } : undefined}
						/>
					</div>
					<Card className="flex flex-1 flex-col border-border/80 bg-card/80">
                <CardHeader className="flex-shrink-0 pb-0">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-1">
                                    <Button
                                        variant={chartView === 'chips' ? 'default' : 'ghost'}
                                        size="lg"
                                        type="button"
                                        className="px-4"
                                        onClick={() => setChartView('chips')}
                                    >
                                        Chips Won
                                    </Button>
                                    <Button
                                        variant={chartView === 'bankroll' ? 'default' : 'ghost'}
                                        size="lg"
                                        type="button"
                                        className="px-4"
                                        onClick={() => setChartView('bankroll')}
                                    >
                                        Bankroll
                                    </Button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative inline-block">
                                    <Button
                                            variant={moreOpen ? 'default' : 'secondary'}
                                            size="sm"
                                            type="button"
                                            onClick={() => {
                                                setMoreOpen((v) => !v);
                                            }}
                                        >
                                            {rangeLabel === 'Date' ? 'Date' : `Date: ${rangeLabel}`}
                                        </Button>
                                        {moreOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                                             <div className="absolute left-0 z-50 mt-2 w-[360px] rounded-md border border-border/70 bg-popover p-3 text-popover-foreground shadow-lg">
                                                 <div className="space-y-3">
                                                    <div className="text-xs font-medium text-muted-foreground">Quick</div>
                                                     <div className="flex flex-wrap gap-2">
                                                        
                                                         <Button variant={period === 'today' ? 'default' : 'secondary'} size="sm" type="button" onClick={() => { setPeriod('today'); setMoreOpen(false); }}>Today</Button>
                                                         <Button variant={period === 'yesterday' ? 'default' : 'secondary'} size="sm" type="button" onClick={() => { setPeriod('yesterday'); setMoreOpen(false); }}>Yesterday</Button>
                                                         <Button variant={period === 'this-week' ? 'default' : 'secondary'} size="sm" type="button" onClick={() => { setPeriod('this-week'); setMoreOpen(false); }}>This week</Button>
                                                         <Button variant={period === 'this-month' ? 'default' : 'secondary'} size="sm" type="button" onClick={() => { setPeriod('this-month'); setMoreOpen(false); }}>This month</Button>
                                                     </div>
                                                     <div className="text-xs font-medium text-muted-foreground">Custom range</div>
                                                     <div className="grid grid-cols-2 gap-2 text-sm">
                                                         <label className="flex items-center gap-2">
                                                             <input type="radio" name="custom-mode" checked={customMode === 'since'} onChange={() => setCustomMode('since')} />
                                                             <span>Since Date</span>
                                                         </label>
                                                         <label className="flex items-center gap-2">
                                                             <input type="radio" name="custom-mode" checked={customMode === 'before'} onChange={() => setCustomMode('before')} />
                                                             <span>Before Date</span>
                                                         </label>
                                                         <label className="col-span-2 flex items-center gap-2">
                                                             <input type="radio" name="custom-mode" checked={customMode === 'betweenDates'} onChange={() => setCustomMode('betweenDates')} />
                                                             <span>Between Dates</span>
                                                         </label>
                                                         <label className="col-span-2 flex items-center gap-2">
                                                             <input type="radio" name="custom-mode" checked={customMode === 'betweenHours'} onChange={() => setCustomMode('betweenHours')} />
                                                             <span>Between Hours</span>
                                                         </label>
                                                         <label className="col-span-2 flex items-center gap-2">
                                                             <input type="radio" name="custom-mode" checked={customMode === 'onDate'} onChange={() => setCustomMode('onDate')} />
                                                             <span>Select Date</span>
                                                         </label>
                                                     </div>
                                                     <div className="space-y-2">
                                                         {customMode === 'since' && (
                                                             <div className="grid gap-2">
                                                                 <Label htmlFor="since-date">Date</Label>
                                                                 <Input id="since-date" type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} />
                                                             </div>
                                                         )}
                                                         {customMode === 'onDate' && (
                                                             <div className="grid gap-2">
                                                                 <Label htmlFor="on-date">Date</Label>
                                                                 <Input id="on-date" type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} />
                                                             </div>
                                                         )}
                                                         {customMode === 'before' && (
                                                             <div className="grid gap-2">
                                                                 <Label htmlFor="before-date">Date</Label>
                                                                 <Input id="before-date" type="date" value={draftDateTo} onChange={(e) => setDraftDateTo(e.target.value)} />
                                                             </div>
                                                         )}
                                                         {customMode === 'betweenDates' && (
                                                             <div className="grid grid-cols-2 gap-3">
                                                                 <div className="grid gap-2">
                                                                     <Label htmlFor="between-from">From</Label>
                                                                     <Input id="between-from" type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} />
                                                                 </div>
                                                                 <div className="grid gap-2">
                                                                     <Label htmlFor="between-to">To</Label>
                                                                     <Input id="between-to" type="date" value={draftDateTo} onChange={(e) => setDraftDateTo(e.target.value)} />
                                                                 </div>
                                                             </div>
                                                         )}
                                                         {customMode === 'betweenHours' && (
                                                             <div className="grid grid-cols-2 gap-3">
                                                                 <div className="grid gap-2">
                                                                     <Label htmlFor="hours-from">From</Label>
                                                                     <Input id="hours-from" type="time" value={draftTimeFrom} onChange={(e) => setDraftTimeFrom(e.target.value)} />
                                                                 </div>
                                                                 <div className="grid gap-2">
                                                                     <Label htmlFor="hours-to">To</Label>
                                                                     <Input id="hours-to" type="time" value={draftTimeTo} onChange={(e) => setDraftTimeTo(e.target.value)} />
                                                                 </div>
                                                             </div>
                                                         )}
                                                     </div>
                                                     <div className="flex items-center justify-end gap-2 pt-2">
													<Button
														variant="secondary"
														size="sm"
														type="button"
														onClick={() => {
															setPeriod(null);
															setDateFrom(undefined);
															setDateTo(undefined);
															setTimeFrom(undefined);
															setTimeTo(undefined);
															setDraftDateFrom('');
															setDraftDateTo('');
															setDraftTimeFrom('');
															setDraftTimeTo('');
															setMoreOpen(false);
														}}
													>
														Clear
													</Button>
                                                         <Button
                                                             variant="default"
                                                             size="sm"
                                                             type="button"
                                                             onClick={() => {
                                                                 if (customMode === 'since') {
                                                                     setDateFrom(draftDateFrom || undefined);
                                                                     setDateTo(undefined);
                                                                     setTimeFrom(undefined);
                                                                     setTimeTo(undefined);
                                                                 }
                                                                if (customMode === 'onDate') {
                                                                    const d = draftDateFrom || undefined;
                                                                    setDateFrom(d);
                                                                    setDateTo(d);
                                                                    // Couvrir toute la journée sélectionnée
                                                                    setTimeFrom('00:00');
                                                                    setTimeTo('23:59');
                                                                }
                                                                 if (customMode === 'before') {
                                                                     setDateFrom(undefined);
                                                                     setDateTo(draftDateTo || undefined);
                                                                     setTimeFrom(undefined);
                                                                     setTimeTo(undefined);
                                                                 }
                                                                 if (customMode === 'betweenDates') {
                                                                     setDateFrom(draftDateFrom || undefined);
                                                                     setDateTo(draftDateTo || undefined);
                                                                     setTimeFrom(undefined);
                                                                     setTimeTo(undefined);
                                                                 }
                                                                 if (customMode === 'betweenHours') {
                                                                     // Apply hours across all dates: do not constrain by date
                                                                     setDateFrom(undefined);
                                                                     setDateTo(undefined);
                                                                     setTimeFrom(draftTimeFrom || '00:00');
                                                                     setTimeTo(draftTimeTo || '23:59');
                                                                 }
                                                                 setPeriod('custom');
                                                                 setMoreOpen(false);
                                                             }}
                                                         >
                                                             Apply
                                                         </Button>
                                                     </div>
                                            </div>
                                            </div>
                                            </>
                                        )}
                                </div>
								<div className="relative inline-block">
									<Button
										variant={buyInOpen ? 'default' : 'secondary'}
										size="sm"
										type="button"
										onClick={() => setBuyInOpen((v) => { const next = !v; if (next) setDraftBuyIns(buyIns); return next; })}
									>
										{buyIns.length > 0 ? `Buy-in: ${buyIns.map((c) => `${(c / 100).toFixed(Number.isInteger(c / 100) ? 0 : 2)} €`).join(', ')}` : 'Buy-in'}
									</Button>
									{buyInOpen && (
										<>
											<div className="fixed inset-0 z-40" onClick={() => setBuyInOpen(false)} />
											<div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border/70 bg-popover p-3 text-popover-foreground shadow-lg">
												<div className="mb-2 text-xs font-medium text-muted-foreground">Buy-ins</div>
                                                <div className="max-h-64 space-y-1 overflow-auto pr-1 text-sm">
													{buyInOptions.length === 0 ? (
														<div className="text-muted-foreground">Aucune option</div>
													) : (
														buyInOptions.map((cents) => {
															const eur = (cents / 100).toFixed(Number.isInteger(cents / 100) ? 0 : 2);
															const checked = draftBuyIns.includes(cents);
															return (
																<label key={cents} className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/40">
																	<span>{eur} €</span>
																	<input
																		type="checkbox"
																		checked={checked}
																		onChange={(e) => {
																			const next = e.target.checked ? [...draftBuyIns, cents] : draftBuyIns.filter((v) => v !== cents);
																			setDraftBuyIns(next);
																		}}
																	/>
																</label>
															);
														})
													)}
												</div>
												<div className="mt-2 flex items-center justify-end gap-2">
													<Button size="sm" variant="secondary" type="button" onClick={() => { setDraftBuyIns([]); setBuyIns([]); setBuyInOpen(false); }}>Clear</Button>
													<Button size="sm" variant="default" type="button" onClick={() => { setBuyIns(draftBuyIns); setBuyInOpen(false); }}>Apply</Button>
												</div>
											</div>
										</>
									)}
								</div>
								<div className="relative inline-block">
									<Button
										variant={posOpen ? 'default' : 'secondary'}
										size="sm"
										type="button"
										onClick={() => setPosOpen((v) => { const next = !v; if (next) { setDraftPosition(position); setDraftHuRoles(huRoles); setDraftM3Roles(m3Roles); } return next; })}
									>
										{position
											? (
												position === 'hu'
													? `Position: HU${huRoles.length > 0 ? ` (${huRoles.map((r) => r.toUpperCase()).join(', ')})` : ''}`
													: `Position: 3-max${m3Roles.length > 0 ? ` (${m3Roles.map((r) => r.toUpperCase()).join(', ')})` : ''}`
											)
											: 'Position'}
									</Button>
									{posOpen && (
										<>
											<div className="fixed inset-0 z-40" onClick={() => setPosOpen(false)} />
											<div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border/70 bg-popover p-3 text-popover-foreground shadow-lg">
												<div className="mb-2 text-xs font-medium text-muted-foreground">Position</div>
                                                <div className="space-y-2 text-sm">
                                                    
                                                    <label className="flex items-center gap-2">
                                                        <input type="radio" name="pos" checked={draftPosition === '3max'} onChange={() => { setDraftPosition('3max'); setDraftHuRoles([]); }} />
                                                        <span>3-max</span>
                                                    </label>
                                                    {draftPosition === '3max' && (
                                                        <div className="mt-1 grid grid-cols-3 gap-2 pl-5">
                                                            <label className="flex items-center gap-2 text-xs">
                                                                <input type="checkbox" checked={draftM3Roles.includes('bu')} onChange={(e) => setDraftM3Roles((prev) => e.target.checked ? Array.from(new Set([...prev, 'bu'])) : prev.filter((x) => x !== 'bu'))} />
                                                                <span>BU</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-xs">
                                                                <input type="checkbox" checked={draftM3Roles.includes('sb')} onChange={(e) => setDraftM3Roles((prev) => e.target.checked ? Array.from(new Set([...prev, 'sb'])) : prev.filter((x) => x !== 'sb'))} />
                                                                <span>SB</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-xs">
                                                                <input type="checkbox" checked={draftM3Roles.includes('bb')} onChange={(e) => setDraftM3Roles((prev) => e.target.checked ? Array.from(new Set([...prev, 'bb'])) : prev.filter((x) => x !== 'bb'))} />
                                                                <span>BB</span>
                                                            </label>
                                                        </div>
                                                    )}
                                                    <label className="flex items-center gap-2">
                                                        <input type="radio" name="pos" checked={draftPosition === 'hu'} onChange={() => { setDraftPosition('hu'); setDraftM3Roles([]); }} />
                                                        <span>HU</span>
                                                    </label>
                                                    {draftPosition === 'hu' && (
                                                        <div className="mt-1 grid grid-cols-2 gap-2 pl-5">
                                                            <label className="flex items-center gap-2 text-xs">
                                                                <input type="checkbox" checked={draftHuRoles.includes('sb')} onChange={(e) => setDraftHuRoles((prev) => e.target.checked ? Array.from(new Set([...prev, 'sb'])) : prev.filter((x) => x !== 'sb'))} />
                                                                <span>SB</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-xs">
                                                                <input type="checkbox" checked={draftHuRoles.includes('bb')} onChange={(e) => setDraftHuRoles((prev) => e.target.checked ? Array.from(new Set([...prev, 'bb'])) : prev.filter((x) => x !== 'bb'))} />
                                                                <span>BB</span>
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2 flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="secondary" type="button" onClick={() => { setDraftPosition(undefined); setDraftHuRoles([]); setDraftM3Roles([]); setPosition(undefined); setHuRoles([]); setM3Roles([]); setPosOpen(false); }}>Clear</Button>
                                                    <Button size="sm" variant="default" type="button" onClick={() => {
                                                        if (draftPosition === 'hu') {
                                                            setPosition('hu');
                                                            setHuRoles(draftHuRoles);
                                                            setM3Roles([]);
                                                        } else if (draftPosition === '3max') {
                                                            setPosition('3max');
                                                            setM3Roles(draftM3Roles);
                                                            setHuRoles([]);
                                                        } else {
                                                            setPosition(undefined);
                                                            setHuRoles([]);
                                                            setM3Roles([]);
                                                        }
                                                        setPosOpen(false);
                                                    }}>Apply</Button>
												</div>
											</div>
										</>
									)}
								</div>
                                <div className="relative inline-block">
                                    <Button
                                        variant={effOpen ? 'default' : 'secondary'}
                                        size="sm"
                                        type="button"
                                        onClick={() => setEffOpen((v) => { const n = !v; if (n) { setDraftEffMin(effMin); setDraftEffMax(effMax); } return n; })}
                                    >
                                        {effMin || effMax ? `Stack: ${effMin || '0'}–${effMax || '∞'} BB` : 'Stack effectif'}
                                    </Button>
                                    {effOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setEffOpen(false)} />
                                            <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border/70 bg-popover p-3 text-popover-foreground shadow-lg">
											<div className="mb-2 text-xs font-medium text-muted-foreground">Stack effectif (BB)</div>
											<div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div className="grid gap-1">
                                                        <Label htmlFor="eff-min">Min</Label>
                                                        <Input id="eff-min" type="number" inputMode="decimal" value={draftEffMin} onChange={(e) => setDraftEffMin(e.target.value)} />
                                                    </div>
                                                    <div className="grid gap-1">
                                                        <Label htmlFor="eff-max">Max</Label>
                                                        <Input id="eff-max" type="number" inputMode="decimal" value={draftEffMax} onChange={(e) => setDraftEffMax(e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="secondary" type="button" onClick={() => { setDraftEffMin(''); setDraftEffMax(''); setEffMin(''); setEffMax(''); setEffOpen(false); }}>Clear</Button>
                                                    <Button size="sm" variant="default" type="button" onClick={() => { setEffMin(draftEffMin); setEffMax(draftEffMax); setEffOpen(false); }}>Apply</Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
								<div className="relative inline-block">
									<Button
										variant={othersOpen ? 'default' : 'secondary'}
										size="sm"
										type="button"
										onClick={() => setOthersOpen((v) => { const n = !v; if (n) setDraftPhase(phase); return n; })}
									>
										{phase ? `Others: ${phase === 'postflop' ? 'Postflop' : 'Preflop'}` : 'Others'}
									</Button>
									{othersOpen && (
										<>
											<div className="fixed inset-0 z-40" onClick={() => setOthersOpen(false)} />
											<div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border/70 bg-popover p-3 text-popover-foreground shadow-lg">
												<div className="mb-2 text-xs font-medium text-muted-foreground">Others</div>
												<div className="space-y-2 text-sm">
													<label className="flex items-center gap-2">
														<input type="radio" name="phase" checked={draftPhase === 'preflop'} onChange={() => setDraftPhase('preflop')} />
														<span>Preflop</span>
													</label>
													<label className="flex items-center gap-2">
														<input type="radio" name="phase" checked={draftPhase === 'postflop'} onChange={() => setDraftPhase('postflop')} />
														<span>Postflop</span>
													</label>
												</div>
												<div className="mt-2 flex items-center justify-end gap-2">
													<Button size="sm" variant="secondary" type="button" onClick={() => { setDraftPhase(undefined); setPhase(undefined); setOthersOpen(false); }}>Clear</Button>
													<Button size="sm" variant="default" type="button" onClick={() => { setPhase(draftPhase); setOthersOpen(false); }}>Apply</Button>
												</div>
											</div>
										</>
									)}
								</div>
                            </div>
                        </div>
						</CardHeader>
                        <CardContent className="flex min-h-0 flex-1 pt-6">
                            {chartView === 'chips' ? (
                              <EvCurveChart
                                period={period && period !== 'custom' ? period : undefined}
                                dateFrom={period === 'custom' ? (dateFrom ? toIsoDateTime(dateFrom, timeFrom) : undefined) : undefined}
                                dateTo={period === 'custom' ? (dateTo ? toIsoDateTime(dateTo, timeTo) : undefined) : undefined}
                                hoursFrom={period === 'custom' ? (timeFrom || undefined) : undefined}
                                hoursTo={period === 'custom' ? (timeTo || undefined) : undefined}
											buyIns={buyIns}
								position={position}
								huRoles={huRoles}
								m3Roles={m3Roles}
                                effMinBB={effMin ? Number(effMin) : undefined}
                                effMaxBB={effMax ? Number(effMax) : undefined}
										phase={phase}
                              />
                            ) : (
                              <BankrollCurveChart
                                period={period && period !== 'custom' ? period : undefined}
                                dateFrom={period === 'custom' ? (dateFrom ? toIsoDateTime(dateFrom, timeFrom) : undefined) : undefined}
                                dateTo={period === 'custom' ? (dateTo ? toIsoDateTime(dateTo, timeTo) : undefined) : undefined}
                                hoursFrom={period === 'custom' ? (timeFrom || undefined) : undefined}
                                hoursTo={period === 'custom' ? (timeTo || undefined) : undefined}
									buyIns={buyIns}
                              />
                            )}
                        </CardContent>
					</Card>
				</section>
			)}
		</main>
	);
}

function Kpi({ label, value, valueClassName, valueStyle }: { label: string; value: number | string; valueClassName?: string; valueStyle?: React.CSSProperties }) {
	return (
		<Card className="flex h-full flex-col items-center justify-center gap-2 px-4 py-5 text-center">
			<CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
				{label}
			</CardDescription>
			<CardTitle className={`text-3xl font-semibold text-foreground ${valueClassName ?? ''}`} style={valueStyle}>
				{value}
			</CardTitle>
		</Card>
	);
}

function formatEuros(cents: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

function formatChips(value: number) {
	return new Intl.NumberFormat('en-US').format(value);
}
