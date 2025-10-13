"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
			.then(async (r) => {
				if (!r.ok) throw new Error(await r.text());
				return r.json();
			})
			.then((data) => {
				setRows(Array.isArray(data) ? data : []);
			})
			.catch(() => setError('Impossible de charger les tournois.'));
	}, []);
	return (
		<div className="max-w-4xl mx-auto p-6 space-y-4">
			<h1 className="text-2xl font-semibold">Tournois</h1>
			{error && <p className="text-sm text-red-600">{error}</p>}
			<div className="border rounded">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-left border-b">
							<th className="p-2">Date</th>
							<th className="p-2">Buy-in</th>
							<th className="p-2">Prize pool</th>
							<th className="p-2">x</th>
							<th className="p-2">Résultat</th>
							<th className="p-2">Profit</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((t) => (
							<tr key={t.id} className="border-b">
								<td className="p-2"><Link className="text-blue-600 underline" href={`/tournaments/${t.id}`}>{new Date(t.startedAt).toLocaleString()}</Link></td>
								<td className="p-2">{formatEuros(t.buyInCents + t.rakeCents)}</td>
								<td className="p-2">{formatEuros(t.prizePoolCents)}</td>
								<td className="p-2">{t.prizeMultiplier}</td>
								<td className="p-2">{t.heroResultPosition ?? '-'}</td>
								<td className="p-2">{formatEuros(t.profitCents)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function formatEuros(cents: number) {
	return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}
