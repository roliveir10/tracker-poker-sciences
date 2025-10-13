"use client";

import { useEffect, useState } from 'react';

type ImportRow = {
	id: string;
	status: string;
	numHands: number;
	createdAt: string;
	completedAt: string | null;
	fileKey: string;
};

export default function ImportsPage() {
	const [file, setFile] = useState<File | null>(null);
	const [status, setStatus] = useState<string>("");
    const [importId, setImportId] = useState<string | null>(null);
	const [rows, setRows] = useState<ImportRow[]>([]);

	async function refresh() {
		const r = await fetch('/api/imports');
		if (r.ok) setRows(await r.json());
	}

	useEffect(() => { refresh(); }, []);

	async function handleUpload() {
		if (!file) return;
		setStatus("Requesting upload URL...");
		const res = await fetch("/api/upload-url", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ filename: file.name, contentType: file.type || "text/plain" }),
		});
		if (!res.ok) { setStatus("Failed to get upload URL"); return; }
		const { url, key } = await res.json();
		setStatus("Uploading to storage...");
		const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "text/plain" } });
		if (!put.ok) { setStatus("Upload failed"); return; }
		setStatus("Creating import record...");
		const create = await fetch('/api/imports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileKey: key, originalName: file.name, size: file.size }) });
		if (!create.ok) { setStatus("Failed to create import record"); return; }
		const data = await create.json();
		setImportId(data.id);
		setStatus(`Queued import ${data.id}`);
		await refresh();
	}

	return (
		<div className="max-w-2xl mx-auto p-6 space-y-6">
			<h1 className="text-2xl font-semibold">Imports</h1>
			<div className="space-x-2">
				<input type="file" accept=".txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
				<button className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={!file} onClick={handleUpload}>Upload</button>
			</div>
			{status && <p className="text-sm text-gray-700">{status}</p>}
			{importId && <p className="text-xs text-gray-500">Import ID: {importId}</p>}

			<div>
				<h2 className="text-lg font-medium mb-2">Historique</h2>
				<div className="border rounded">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left border-b">
								<th className="p-2">ID</th>
								<th className="p-2">Status</th>
								<th className="p-2">Mains</th>
								<th className="p-2">Créé</th>
								<th className="p-2">Terminé</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.id} className="border-b">
									<td className="p-2 font-mono text-xs">{r.id}</td>
									<td className="p-2">{r.status}</td>
									<td className="p-2">{r.numHands}</td>
									<td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
									<td className="p-2">{r.completedAt ? new Date(r.completedAt).toLocaleString() : '-'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
