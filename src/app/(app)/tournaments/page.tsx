"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { buttonVariants } from '@/components/ui/button';

type Tournament = {
	id: string;
	startedAt: string;
	buyInCents: number;
	rakeCents: number;
	prizePoolCents: number;
	prizeMultiplier: number;
	heroResultPosition: number | null;
	profitCents: number;
};

export default function TournamentsPage() {
	const [rows, setRows] = useState<Tournament[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch('/api/tournaments')
			.then(async (response) => {
				if (!response.ok) throw new Error(await response.text());
				return response.json();
			})
			.then((data) => {
				setRows(Array.isArray(data) ? data : []);
			})
			.catch(() => setError('Unable to load tournaments.'));
	}, []);

	return (
		<main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight text-foreground">Tournaments</h1>
				<p className="text-sm text-muted-foreground">
					Explore completed Spin &amp; Go games, their multipliers, and the associated profits.
				</p>
			</div>

			{error && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</div>
			)}

			<Card>
				<CardHeader className="space-y-1">
					<CardTitle>Tournament history</CardTitle>
					<CardDescription>
						Check multipliers, prize pools, and your results for each Spin &amp; Go.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date</TableHead>
								<TableHead>Buy-in</TableHead>
								<TableHead>Prize pool</TableHead>
								<TableHead>Multiplier</TableHead>
								<TableHead>Result</TableHead>
								<TableHead className="text-right">Profit</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell>
										<Link
											className={buttonVariants({ variant: 'link' })}
											href={`/tournaments/${row.id}`}
										>
											{new Date(row.startedAt).toLocaleString("en-US")}
										</Link>
									</TableCell>
									<TableCell>{formatEuros(row.buyInCents + row.rakeCents)}</TableCell>
									<TableCell>{formatEuros(row.prizePoolCents)}</TableCell>
									<TableCell>{row.prizeMultiplier}</TableCell>
									<TableCell>{row.heroResultPosition ?? '—'}</TableCell>
									<TableCell className="text-right">{formatEuros(row.profitCents)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{rows.length === 0 && (
						<div className="mt-6 rounded-md border border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
							No tournaments yet. Import your hands to populate this section.
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}

function formatEuros(cents: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}
