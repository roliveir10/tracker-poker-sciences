"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface HandRow {
	id: string;
	handNo: string | null;
	heroSeat: number | null;
	sbCents: number | null;
	bbCents: number | null;
	board: string | null;
	playedAt: string | null;
}

export default function TournamentDetailPage() {
	const params = useParams<{ id: string }>();
	const id = params?.id as string;
	const [rows, setRows] = useState<HandRow[]>([]);

	useEffect(() => {
		if (!id) return;
		fetch(`/api/tournaments/${id}/hands`).then(r => r.json()).then(setRows).catch(() => {});
	}, [id]);

	return (
		<div className="max-w-4xl mx-auto p-6 space-y-4">
			<h1 className="text-2xl font-semibold">Tournoi {id}</h1>
			<div className="border rounded">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-left border-b">
							<th className="p-2">Hand</th>
							<th className="p-2">Hero seat</th>
							<th className="p-2">Blinds</th>
							<th className="p-2">Board</th>
							<th className="p-2">Date</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((h) => (
							<tr key={h.id} className="border-b">
								<td className="p-2 font-mono text-xs">{h.handNo || '-'}</td>
								<td className="p-2">{h.heroSeat ?? '-'}</td>
								<td className="p-2">{h.sbCents ?? '-'} / {h.bbCents ?? '-'}</td>
								<td className="p-2">{h.board ?? '-'}</td>
								<td className="p-2">{h.playedAt ? new Date(h.playedAt).toLocaleString() : '-'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

