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
const [status, setStatus] = useState<string>('');
const statusPollIntervalRef = useRef<number | null>(null);
const overallEstimateMsRef = useRef<number | null>(null);
const overallStartAtRef = useRef<number | null>(null);
const overallIntervalRef = useRef<number | null>(null);
const [overallProgress, setOverallProgress] = useState<number | null>(null);
const [importId, setImportId] = useState<string | null>(null);
const [rows, setRows] = useState<ImportRow[]>([]);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const folderInputRef = useRef<HTMLInputElement | null>(null);
// estimation globale via poids fichier plutôt que lecture du contenu
	type FolderEntry = { file: File; path: string };
	type FileEntryLike = {
		isFile: true;
		isDirectory: false;
		name: string;
		file: (callback: (file: File) => void) => void;
	};
	type DirEntryLike = {
		isFile: false;
		isDirectory: true;
		name: string;
		createReader: () => {
			readEntries: (cb: (entries: EntryLike[]) => void) => void;
		};
	};
	type EntryLike = FileEntryLike | DirEntryLike;

	const isFileEntry = (entry: unknown): entry is FileEntryLike => {
		if (!entry || typeof entry !== 'object') return false;
		const e = entry as Partial<FileEntryLike>;
		return e.isFile === true && e.isDirectory === false && typeof e.name === 'string' && typeof e.file === 'function';
	};

	const isDirEntry = (entry: unknown): entry is DirEntryLike => {
		if (!entry || typeof entry !== 'object') return false;
		const e = entry as Partial<DirEntryLike>;
		return e.isFile === false && e.isDirectory === true && typeof e.name === 'string' && typeof e.createReader === 'function';
	};

	async function refresh() {
		const r = await fetch('/api/imports');
		if (r.ok) setRows(await r.json());
	}

	useEffect(() => {
		void refresh();
	}, []);

useEffect(() => {
    return () => {
        if (statusPollIntervalRef.current) window.clearInterval(statusPollIntervalRef.current);
    };
}, []);

	async function uploadBlob(blob: Blob, originalName: string, contentType: string) {
		const controller = new AbortController();
		setStatus("Demande d'URL de téléversement...");
		const res = await fetch('/api/upload-url', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename: originalName, contentType }),
		});
		if (!res.ok) {
			setStatus("Impossible d'obtenir l'URL de téléversement");
			return;
		}
	const { url, key } = await res.json();
	setStatus('Téléversement vers le stockage...');
	const putOk = await fetch(url, {
		method: 'PUT',
		headers: { 'Content-Type': contentType },
		body: blob,
		signal: controller.signal,
	});
	if (!putOk.ok) {
		setStatus("Échec du téléversement");
		return;
	}
		setStatus("Création de l'import...");
		const create = await fetch('/api/imports', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fileKey: key, originalName, size: blob.size }),
		});
		if (!create.ok) {
			setStatus("Impossible de créer l'import");
			return;
		}
		const data = await create.json();
		setImportId(data.id);
		setStatus(`Import ${data.id} en file d'attente`);
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
				await refresh();
				setTimeout(() => setOverallProgress(null), 600);
			}
		}, 1500);
	}


	async function buildFolderZipFromEntries(entries: FolderEntry[]) : Promise<{ blob: Blob; name: string; numFiles: number; size: number; kind: 'folder' | 'zip' } | null> {
		const zipCandidates = entries.filter((entry) => entry.path.toLowerCase().endsWith('.zip'));
		if (zipCandidates.length > 0) {
			const zipFile = zipCandidates[0].file;
			setStatus(`Archive ZIP détectée : ${zipFile.name}`);
			return { blob: zipFile, name: zipFile.name, numFiles: 1, size: zipFile.size, kind: 'zip' };
		}

		const txtEntries = entries.filter((entry) => entry.path.toLowerCase().endsWith('.txt'));
		if (txtEntries.length === 0) {
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
		const blob = new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
		setStatus(`Archive prête : ${txtEntries.length} fichiers, ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
		return { blob, name: `hands-${Date.now()}.zip`, numFiles: txtEntries.length, size: blob.size, kind: 'folder' };
	}

	async function extractFilesFromDataTransfer(dt: DataTransfer): Promise<FolderEntry[]> {
		const collected: FolderEntry[] = [];

		const traverse = async (entry: EntryLike, base: string) => {
			if (isFileEntry(entry)) {
				await new Promise<void>((resolve) => {
					entry.file((file) => {
						collected.push({ file, path: base ? `${base}/${file.name}` : file.name });
						resolve();
					});
				});
			} else if (isDirEntry(entry)) {
				await new Promise<void>((resolve) => {
					const reader = entry.createReader();
					reader.readEntries(async (entries) => {
						for (const child of entries) {
							if (isFileEntry(child) || isDirEntry(child)) await traverse(child as EntryLike, base ? `${base}/${entry.name}` : entry.name);
						}
						resolve();
					});
				});
			}
		};

		for (const item of dt.items) {
			const itemWithEntry = item as DataTransferItem & { webkitGetAsEntry?: () => unknown };
			if (typeof itemWithEntry.webkitGetAsEntry === 'function') {
				const entry = itemWithEntry.webkitGetAsEntry();
				if (isFileEntry(entry) || isDirEntry(entry)) {
					await traverse(entry as EntryLike, '');
				} else {
					const fallbackFile = item.getAsFile?.();
					if (fallbackFile) collected.push({ file: fallbackFile, path: fallbackFile.name });
				}
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
			return;
		}
		const entries: FolderEntry[] = Array.from(files).map((entryFile) => ({
			file: entryFile,
			path: (entryFile as File & { webkitRelativePath?: string }).webkitRelativePath || entryFile.name,
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
			setStatus("Aucun fichier .txt trouvé dans le dossier");
			return;
		}
		// Si un seul fichier .txt est déposé, on traite comme un fichier direct
		if (entries.length === 1 && entries[0].path.toLowerCase().endsWith('.txt')) {
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
								const isZip = f.name.toLowerCase().endsWith('.zip') || Boolean(f.type && /zip/i.test(f.type));
								setEstimateFromFileSize(f.size, Boolean(isZip));
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
