"use client";

import { useEffect, useState } from 'react';
import {
	ResponsiveContainer,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
} from 'recharts';

type Stats = {
	tournaments: number;
	hands: number;
	totalBuyInCents: number;
	totalRakeCents: number;
	totalProfitCents: number;
	roiPct: number;
	itmPct: number;
	multiplierHistogram: Array<{ multiplier: number; count: number }>;
};

export default function DashboardPage() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch('/api/stats')
			.then(async (r) => {
				if (!r.ok) throw new Error('failed');
				return r.json();
			})
			.then(setStats)
			.catch(() => setError('Impossible de charger les statistiques.'));
	}, []);

	return (
		<div className="max-w-4xl mx-auto p-6 space-y-6">
			<h1 className="text-2xl font-semibold">Dashboard</h1>
			{error && <p className="text-red-600 text-sm">{error}</p>}
			{stats && (
				<>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<Kpi label="Tournois" value={stats.tournaments} />
						<Kpi label="Mains" value={stats.hands} />
						<Kpi label="Profit" value={formatEuros(stats.totalProfitCents)} />
						<Kpi label="ROI" value={`${stats.roiPct.toFixed(1)}%`} />
					</div>
					<div>
						<h2 className="text-lg font-medium mb-2">Distribution des multiplicateurs</h2>
						<div style={{ width: '100%', height: 300 }}>
							<ResponsiveContainer>
								<BarChart data={stats.multiplierHistogram}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="multiplier" />
									<YAxis allowDecimals={false} />
									<Tooltip />
									<Bar dataKey="count" fill="#2563eb" />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function Kpi({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="p-4 rounded border border-gray-200">
			<div className="text-xs text-gray-500">{label}</div>
			<div className="text-xl font-semibold">{value}</div>
		</div>
	);
}

function formatEuros(cents: number) {
	return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}

