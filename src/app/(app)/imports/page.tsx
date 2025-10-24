"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { zipSync } from 'fflate';
import {
	Button,
	buttonVariants,
} from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

type ImportRow = {
  id: string;
  status: string;
  numHands: number;
  numImported?: number;
  numDuplicates?: number;
  numInvalid?: number;
  createdAt: string;
  completedAt: string | null;
  fileKey: string;
};

export default function ImportsPage() {
	const [file, setFile] = useState<File | null>(null);
	const [status, setStatus] = useState<string>('');
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const [uploadSpeedBps, setUploadSpeedBps] = useState<number | null>(null);
	const [uploadEtaSeconds, setUploadEtaSeconds] = useState<number | null>(null);
	const [uploadTotalBytes, setUploadTotalBytes] = useState<number | null>(null);
	const [uploadLoadedBytes, setUploadLoadedBytes] = useState<number | null>(null);
	const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'finalizing'>('idle');
const [overallProgress, setOverallProgress] = useState<number | null>(null);
const statusPollIntervalRef = useRef<number | null>(null);
const overallEstimateMsRef = useRef<number | null>(null);
const overallStartAtRef = useRef<number | null>(null);
const overallIntervalRef = useRef<number | null>(null);
	const [importId, setImportId] = useState<string | null>(null);
	const [rows, setRows] = useState<ImportRow[]>([]);
	const [folderZip, setFolderZip] = useState<{ blob: Blob; name: string; numFiles: number; size: number; kind: 'folder' | 'zip' } | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const folderInputRef = useRef<HTMLInputElement | null>(null);
// estimation globale via poids fichier plutôt que lecture du contenu
	type FolderEntry = { file: File; path: string };

	async function refresh() {
		const r = await fetch('/api/imports');
		if (r.ok) setRows(await r.json());
	}

	useEffect(() => {
		void refresh();
	}, []);

useEffect(() => {
    return () => {
        if (overallIntervalRef.current) window.clearInterval(overallIntervalRef.current);
        if (statusPollIntervalRef.current) window.clearInterval(statusPollIntervalRef.current);
    };
}, []);

	async function uploadBlob(blob: Blob, originalName: string, contentType: string) {
		setUploadPhase('uploading');
		setUploadProgress(0);
		setStatus("Demande d'URL de téléversement...");
		const res = await fetch('/api/upload-url', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename: originalName, contentType }),
		});
		if (!res.ok) {
			setStatus("Impossible d'obtenir l'URL de téléversement");
			setUploadProgress(null);
			setUploadPhase('idle');
			return;
		}
		const { url, key } = await res.json();
		setStatus('Téléversement vers le stockage...');
		const putOk = await new Promise<boolean>((resolve) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', url, true);
			const uploadStartedAt = Date.now();
			setUploadTotalBytes(blob.size);
			setUploadLoadedBytes(0);
			setUploadSpeedBps(0);
			setUploadEtaSeconds(null);
				xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) {
					const total = e.total || blob.size;
					const loaded = e.loaded;
					const pct = Math.round((loaded / total) * 100);
					// On évite d'afficher 100% tant que le PUT n'est pas terminé
					const clamped = Math.min(95, pct);
					setUploadProgress(clamped);
					setUploadLoadedBytes(loaded);
					setUploadTotalBytes(total);
					const elapsedSec = Math.max(0.001, (Date.now() - uploadStartedAt) / 1000);
					const speed = loaded / elapsedSec; // bytes/sec
					setUploadSpeedBps(speed);
					const remaining = Math.max(0, total - loaded);
					const eta = speed > 0 ? remaining / speed : null;
					setUploadEtaSeconds(eta !== null ? Math.round(eta) : null);
				}
			};
			xhr.onload = () => {
				resolve(xhr.status >= 200 && xhr.status < 300);
			};
			xhr.onerror = () => resolve(false);
			xhr.setRequestHeader('Content-Type', contentType);
			xhr.send(blob);
		});
		if (!putOk) {
			setStatus("Échec du téléversement");
			setUploadProgress(null);
			setUploadSpeedBps(null);
			setUploadEtaSeconds(null);
			setUploadTotalBytes(null);
			setUploadLoadedBytes(null);
			setUploadPhase('idle');
			return;
		}
		// Le PUT est terminé : on passe en finalisation et on masque les compteurs
		setUploadLoadedBytes(null);
		setUploadTotalBytes(null);
		setUploadSpeedBps(null);
		setUploadEtaSeconds(null);
		setUploadPhase('finalizing');
		setUploadProgress(100);
		setStatus("Création de l'import...");
		const create = await fetch('/api/imports', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fileKey: key, originalName, size: blob.size }),
		});
		if (!create.ok) {
			setStatus("Impossible de créer l'import");
			setUploadProgress(null);
			setUploadSpeedBps(null);
			setUploadEtaSeconds(null);
			setUploadTotalBytes(null);
			setUploadLoadedBytes(null);
			setUploadPhase('idle');
			return;
		}
		const data = await create.json();
		setImportId(data.id);
		setStatus(`Import ${data.id} en file d'attente`);
		setUploadProgress(null);
		setUploadSpeedBps(null);
		setUploadEtaSeconds(null);
		setUploadTotalBytes(null);
		setUploadLoadedBytes(null);
		startStatusPolling(data.id);
		await refresh();
	}

	function setEstimateFromFileSize(bytes: number, isZip: boolean) {
		const compressionMultiplier = isZip ? 6 : 1; // facteur pour ZIP
		const effectiveBytes = Math.max(1, bytes * compressionMultiplier);
		const perByteMs = 0.03; // 0,03 ms par octet effectif (~72s pour 400Ko ZIP)
		const minOverheadMs = 3000; // latence minimum perçue
		const estimate = Math.max(minOverheadMs, Math.round(effectiveBytes * perByteMs));
		overallEstimateMsRef.current = estimate;
	}

	function beginOverallProgress() {
		if (overallIntervalRef.current) window.clearInterval(overallIntervalRef.current);
		overallStartAtRef.current = Date.now();
		setOverallProgress(1);
		const est = overallEstimateMsRef.current ?? 10000;
		overallIntervalRef.current = window.setInterval(() => {
			const start = overallStartAtRef.current ?? Date.now();
			const elapsed = Date.now() - start;
			const target = Math.min(90, (elapsed / est) * 100);
			setOverallProgress((prev) => Math.min(90, Math.max(prev ?? 1, target)));
		}, 200);
	}

	function startStatusPolling(newImportId: string) {
		if (statusPollIntervalRef.current) window.clearInterval(statusPollIntervalRef.current);
		statusPollIntervalRef.current = window.setInterval(async () => {
			const r = await fetch('/api/imports');
			if (!r.ok) return;
			const items: ImportRow[] = await r.json();
			const item = items.find((it) => it.id === newImportId);
			if (!item) return;
			if (item.status === 'done' || item.status === 'failed') {
				if (overallIntervalRef.current) window.clearInterval(overallIntervalRef.current);
				if (statusPollIntervalRef.current) window.clearInterval(statusPollIntervalRef.current);
				setOverallProgress(100);
				setStatus(item.status === 'done' ? "Import terminé" : "Échec de l'import");
				setUploadPhase('idle');
				await refresh();
				setTimeout(() => setOverallProgress(null), 600);
			}
		}, 1500);
	}

	function formatBytes(value: number): string {
		const units = ['octets', 'Ko', 'Mo', 'Go', 'To'];
		let v = value;
		let i = 0;
		while (v >= 1024 && i < units.length - 1) {
			v /= 1024;
			i += 1;
		}
		return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
	}

	function formatBps(bps: number): string {
		if (bps < 1) return '0 o/s';
		const units = ['o/s', 'Ko/s', 'Mo/s', 'Go/s'];
		let v = bps;
		let i = 0;
		while (v >= 1024 && i < units.length - 1) {
			v /= 1024;
			i += 1;
		}
		return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
	}

	function formatDuration(totalSeconds: number): string {
		const s = Math.max(0, Math.floor(totalSeconds));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	async function handleUploadSingle() {
		if (!file) return;
		const isZip = file.name.toLowerCase().endsWith('.zip') || (file.type && /zip/i.test(file.type));
		await uploadBlob(file, file.name, isZip ? 'application/zip' : file.type || 'text/plain');
	}

	async function buildFolderZipFromEntries(entries: FolderEntry[]) : Promise<{ blob: Blob; name: string; numFiles: number; size: number; kind: 'folder' | 'zip' } | null> {
		const zipCandidates = entries.filter((entry) => entry.path.toLowerCase().endsWith('.zip'));
		if (zipCandidates.length > 0) {
			const zipFile = zipCandidates[0].file;
			setFolderZip({ blob: zipFile, name: zipFile.name, numFiles: 1, size: zipFile.size, kind: 'zip' });
			setStatus(`Archive ZIP détectée : ${zipFile.name}`);
			return { blob: zipFile, name: zipFile.name, numFiles: 1, size: zipFile.size, kind: 'zip' };
		}

		const txtEntries = entries.filter((entry) => entry.path.toLowerCase().endsWith('.txt'));
		if (txtEntries.length === 0) {
			setFolderZip(null);
			setStatus("Aucun fichier .txt trouvé dans le dossier");
			return null;
		}
		setStatus(`Préparation de l'archive (${txtEntries.length} fichiers)...`);
		const filesObj: Record<string, Uint8Array> = {};
		for (const { file: txtFile, path } of txtEntries) {
			const buf = new Uint8Array(await txtFile.arrayBuffer());
			filesObj[path] = buf;
		}
		const zipped = zipSync(filesObj, { level: 6 });
		const blob = new Blob([zipped], { type: 'application/zip' });
		setFolderZip({ blob, name: `hands-${Date.now()}.zip`, numFiles: txtEntries.length, size: blob.size, kind: 'folder' });
		setStatus(`Archive prête : ${txtEntries.length} fichiers, ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
		return { blob, name: `hands-${Date.now()}.zip`, numFiles: txtEntries.length, size: blob.size, kind: 'folder' };
	}

	async function extractFilesFromDataTransfer(dt: DataTransfer): Promise<FolderEntry[]> {
		const collected: FolderEntry[] = [];
		const items = Array.from(dt.items || []);
		const traverse = async (entry: any, base: string) => {
			if (!entry) return;
			if (entry.isFile) {
				await new Promise<void>((resolve) => {
					entry.file((entryFile: File) => {
						const fullPath = base + entry.name;
						collected.push({ file: entryFile, path: fullPath });
						resolve();
					});
				});
			} else if (entry.isDirectory) {
				const reader = entry.createReader();
				await new Promise<void>((resolve) => {
					const readBatch = () => {
						reader.readEntries(async (entries: any[]) => {
							if (!entries || entries.length === 0) {
								resolve();
								return;
							}
							for (const subEntry of entries) {
								await traverse(subEntry, base + entry.name + '/');
							}
							readBatch();
						});
					};
					readBatch();
				});
			}
		};
		for (const item of items) {
			const anyItem = item as any;
			if (typeof anyItem.webkitGetAsEntry === 'function') {
				const entry = anyItem.webkitGetAsEntry();
				if (entry) await traverse(entry, '');
			} else {
				const fallbackFile = item.getAsFile?.();
				if (fallbackFile) collected.push({ file: fallbackFile, path: fallbackFile.name });
			}
		}
		return collected;
	}

	async function handleFolderInput(event: React.ChangeEvent<HTMLInputElement>) {
		const files = event.target.files;
		if (!files || files.length === 0) {
			setFolderZip(null);
			return;
		}
		const entries: FolderEntry[] = Array.from(files).map((entryFile) => ({
			file: entryFile,
			path: (entryFile as any).webkitRelativePath || entryFile.name,
		}));
		const built = await buildFolderZipFromEntries(entries);
		if (built) {
			setEstimateFromFileSize(built.size, true);
			beginOverallProgress();
			await uploadBlob(built.blob, built.name, 'application/zip');
		}
	}

	async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault();
		const dt = event.dataTransfer;
		if (!dt) return;
		const entries = await extractFilesFromDataTransfer(dt);
		if (entries.length === 0) {
			setFolderZip(null);
			setStatus("Aucun fichier .txt trouvé dans le dossier");
			return;
		}
		// Si un seul fichier .txt est déposé, on traite comme un fichier direct
		if (entries.length === 1 && entries[0].path.toLowerCase().endsWith('.txt')) {
			setFolderZip(null);
			setFile(entries[0].file);
			setStatus(`Fichier .txt détecté : ${entries[0].file.name}`);
			setEstimateFromFileSize(entries[0].file.size, false);
			beginOverallProgress();
			await uploadBlob(entries[0].file, entries[0].file.name, 'text/plain');
			return;
		}
		const built = await buildFolderZipFromEntries(entries);
		if (built) {
			setEstimateFromFileSize(built.size, true);
			beginOverallProgress();
			await uploadBlob(built.blob, built.name, 'application/zip');
		}
	}

	function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault();
	}

	async function handleUploadFolder() {
		if (!folderZip) return;
		await uploadBlob(folderZip.blob, folderZip.name, 'application/zip');
	}

	async function handleDeleteImport(id: string) {
		const confirmDelete = window.confirm("Supprimer cet import ?");
		if (!confirmDelete) return;
		setStatus("Suppression de l'import...");
		const res = await fetch(`/api/imports/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			setStatus("Impossible de supprimer l'import");
			return;
		}
		setStatus("Import supprimé");
		await refresh();
	}

	return (
		<main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight text-foreground">Imports</h1>
				<p className="text-sm text-muted-foreground">
					Importez vos historiques Betclic en quelques secondes. Le traitement démarre automatiquement.
				</p>
			</div>

			<Card>
				<CardHeader className="space-y-1">
					<CardTitle>Importer des fichiers ou dossiers</CardTitle>
					<CardDescription>
						Formats acceptés : dossiers, fichiers <code>.zip</code> et <code>.txt</code>. Pour le moment, seuls les fichiers Betclic sont supportés.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					{/* Inputs cachés pour déclencher la sélection via clic */}
					<input
						ref={fileInputRef}
						type="file"
						accept=".txt,.zip"
						className="hidden"
						onChange={async (event) => {
							const f = event.currentTarget.files?.[0];
							if (f) {
							setFile(f);
							const isZip = f.name.toLowerCase().endsWith('.zip') || (f.type && /zip/i.test(f.type));
							setEstimateFromFileSize(f.size, isZip);
							beginOverallProgress();
							await uploadBlob(f, f.name, isZip ? 'application/zip' : f.type || 'text/plain');
							}
						}}
					/>
					<input
						ref={folderInputRef}
						type="file"
						multiple
						/* @ts-expect-error webkitdirectory non-typé */
						webkitdirectory=""
						className="hidden"
						onChange={handleFolderInput}
					/>
					<div
						onClick={(e) => {
							if (e.altKey) {
								folderInputRef.current?.click?.();
							} else {
								fileInputRef.current?.click?.();
							}
						}}
						onDrop={handleDrop}
						onDragOver={handleDragOver}
						className="flex cursor-pointer min-h-[180px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground transition hover:border-primary/60"
					>
						<strong className="text-foreground">Glissez-déposez un dossier, un fichier .zip ou .txt</strong>
						<span>
							Cliquez pour sélectionner un fichier (.zip/.txt). Maintenez Alt et cliquez pour choisir un dossier.
						</span>
					</div>
				</CardContent>
			</Card>

			{status && (
				<div className="rounded-md border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
					{status}
				</div>
			)}
			{(overallProgress !== null) && (
				<div className="rounded-md border border-border/70 bg-muted/30 px-4 py-3">
					<div className="mb-2 text-xs text-muted-foreground">Import en cours...</div>
					<div className="h-2 w-full overflow-hidden rounded bg-muted">
						<div className="h-2 bg-primary transition-all" style={{ width: `${Math.max(1, overallProgress ?? 1)}%` }} />
					</div>
				</div>
			)}
			{importId && (
				<div className="text-xs text-muted-foreground">
					Import in progress: <span className="font-mono text-foreground">{importId}</span>
				</div>
			)}

			<Card>
				<CardHeader className="space-y-1">
					<CardTitle>Historique des imports</CardTitle>
					<CardDescription>
						Suivez le statut des imports et supprimez les entrées inutiles.
					</CardDescription>
				</CardHeader>
				<CardContent>
          <Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[160px]">ID</TableHead>
								<TableHead>Statut</TableHead>
								<TableHead>Mains</TableHead>
								<TableHead>Importées</TableHead>
								<TableHead>Doublons</TableHead>
								<TableHead>Invalides</TableHead>
								<TableHead>Créé</TableHead>
								<TableHead>Terminé</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
									<TableCell className="capitalize">{row.status}</TableCell>
                  <TableCell>{row.numHands}</TableCell>
                  <TableCell>{row.numImported ?? '—'}</TableCell>
                  <TableCell>{row.numDuplicates ?? '—'}</TableCell>
                  <TableCell>{row.numInvalid ?? '—'}</TableCell>
									<TableCell>{new Date(row.createdAt).toLocaleString("fr-FR")}</TableCell>
									<TableCell>{row.completedAt ? new Date(row.completedAt).toLocaleString("fr-FR") : '—'}</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="sm"
											type="button"
											className="text-destructive hover:text-destructive"
											onClick={() => handleDeleteImport(row.id)}
										>
											Supprimer
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{rows.length === 0 && (
						<div className="mt-6 rounded-md border border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
							Aucun import pour le moment. Commencez par{' '}
							<Link href="/imports" className={buttonVariants({ variant: 'link' })}>
								uploader vos fichiers
							</Link>
							.
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
