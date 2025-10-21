"use client";

import { useEffect, useState } from 'react';
import { EvCurveChart } from '@/components/ev-curve-chart';
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

export default function DashboardPage() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [error, setError] = useState<string | null>(null);
	const FILTERS_STORAGE_KEY = 'dashboard:filters:v1';

	function readSaved() {
		try {
			const raw = typeof window !== 'undefined' ? window.localStorage.getItem(FILTERS_STORAGE_KEY) : null;
			return raw ? JSON.parse(raw) as Partial<{
				period: 'today' | 'yesterday' | 'this-week' | 'this-month' | 'custom' | null;
				dateFrom: string | undefined;
				dateTo: string | undefined;
				timeFrom: string | undefined;
				timeTo: string | undefined;
				customMode: 'since' | 'before' | 'betweenDates' | 'betweenHours';
				chartView: 'chips' | 'bankroll';
				moreOpen: boolean;
			}> : null;
		} catch {
			return null;
		}
	}

	const saved = readSaved();
	const [period, setPeriod] = useState<'today' | 'yesterday' | 'this-week' | 'this-month' | 'custom' | null>(() => saved?.period ?? 'today');
	const [dateFrom, setDateFrom] = useState<string | undefined>(() => saved?.dateFrom ?? undefined);
	const [dateTo, setDateTo] = useState<string | undefined>(() => saved?.dateTo ?? undefined);
	const [timeFrom, setTimeFrom] = useState<string | undefined>(() => saved?.timeFrom ?? undefined);
	const [timeTo, setTimeTo] = useState<string | undefined>(() => saved?.timeTo ?? undefined);
	const [moreOpen, setMoreOpen] = useState<boolean>(() => saved?.moreOpen ?? false);
	const [customMode, setCustomMode] = useState<'since' | 'before' | 'betweenDates' | 'betweenHours'>(() => saved?.customMode ?? 'since');
	const [draftDateFrom, setDraftDateFrom] = useState<string>('');
	const [draftDateTo, setDraftDateTo] = useState<string>('');
	const [draftHoursDate, setDraftHoursDate] = useState<string>('');
	const [draftTimeFrom, setDraftTimeFrom] = useState<string>('');
	const [draftTimeTo, setDraftTimeTo] = useState<string>('');
	const [chartView, setChartView] = useState<'chips' | 'bankroll'>(() => saved?.chartView ?? 'chips');

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
			};
			if (typeof window !== 'undefined') {
				window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(data));
			}
		} catch {
			// ignore
		}
	}, [period, dateFrom, dateTo, timeFrom, timeTo, customMode, chartView, moreOpen]);

	const rangeLabel = (() => {
		if (period === 'today') return 'Today';
		if (period === 'yesterday') return 'Yesterday';
		if (period === 'this-week') return 'This week';
		if (period === 'this-month') return 'This month';
		if (period === 'custom') {
			if (customMode === 'since' && dateFrom) return `Since ${dateFrom}`;
			if (customMode === 'before' && dateTo) return `Before ${dateTo}`;
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
    const url = `/api/stats${qs.size ? `?${qs.toString()}` : ''}`;
    fetch(url)
			.then(async (r) => {
				if (!r.ok) throw new Error('failed');
				return r.json();
			})
			.then(setStats)
			.catch(() => setError('Unable to load statistics.'));
  }, [period, dateFrom, dateTo, timeFrom, timeTo]);

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
							valueClassName={
								stats.totalProfitCents > 0
									? 'text-green-500'
									: stats.totalProfitCents < 0
										? 'text-red-500'
										: undefined
							}
						/>
						<Kpi
							label="ROI"
							value={`${stats.roiPct.toFixed(1)}%`}
							valueClassName={
								stats.roiPct > 0 ? 'text-green-500' : stats.roiPct < 0 ? 'text-red-500' : undefined
							}
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
                                            {rangeLabel}
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
                                                     </div>
                                                     <div className="space-y-2">
                                                         {customMode === 'since' && (
                                                             <div className="grid gap-2">
                                                                 <Label htmlFor="since-date">Date</Label>
                                                                 <Input id="since-date" type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} />
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
                                <Button variant="secondary" size="sm" type="button">Buy-in</Button>
                                <Button variant="secondary" size="sm" type="button">Position</Button>
                                <Button variant="secondary" size="sm" type="button">Stack effectif</Button>
                                <Button variant="secondary" size="sm" type="button">Others</Button>
                            </div>
                        </div>
						</CardHeader>
						<CardContent className="flex min-h-0 flex-1 pt-6">
                            <EvCurveChart
                              period={period && period !== 'custom' ? period : undefined}
                              dateFrom={period === 'custom' ? (dateFrom ? toIsoDateTime(dateFrom, timeFrom) : undefined) : undefined}
                              dateTo={period === 'custom' ? (dateTo ? toIsoDateTime(dateTo, timeTo) : undefined) : undefined}
                              hoursFrom={period === 'custom' ? (timeFrom || undefined) : undefined}
                              hoursTo={period === 'custom' ? (timeTo || undefined) : undefined}
                            />
						</CardContent>
					</Card>
				</section>
			)}
		</main>
	);
}

function Kpi({ label, value, valueClassName }: { label: string; value: number | string; valueClassName?: string }) {
	return (
		<Card className="flex h-full flex-col items-center justify-center gap-2 px-4 py-5 text-center">
			<CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
				{label}
			</CardDescription>
			<CardTitle className={`text-3xl font-semibold text-foreground ${valueClassName ?? ''}`}>
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
