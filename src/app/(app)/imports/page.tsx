"use client";

import { useEffect, useState } from 'react';
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
	createdAt: string;
	completedAt: string | null;
	fileKey: string;
};

export default function ImportsPage() {
	const [file, setFile] = useState<File | null>(null);
	const [status, setStatus] = useState<string>('');
	const [importId, setImportId] = useState<string | null>(null);
	const [rows, setRows] = useState<ImportRow[]>([]);
	const [folderZip, setFolderZip] = useState<{ blob: Blob; name: string; numFiles: number; size: number; kind: 'folder' | 'zip' } | null>(null);
	type FolderEntry = { file: File; path: string };

	async function refresh() {
		const r = await fetch('/api/imports');
		if (r.ok) setRows(await r.json());
	}

	useEffect(() => {
		void refresh();
	}, []);

	async function uploadBlob(blob: Blob, originalName: string, contentType: string) {
		setStatus("Requesting upload URL...");
		const res = await fetch('/api/upload-url', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename: originalName, contentType }),
		});
		if (!res.ok) {
			setStatus("Unable to get upload URL");
			return;
		}
		const { url, key } = await res.json();
		setStatus('Uploading to storage...');
		const put = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
		if (!put.ok) {
		setStatus("Upload failed");
			return;
		}
		setStatus("Creating import...");
		const create = await fetch('/api/imports', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fileKey: key, originalName, size: blob.size }),
		});
		if (!create.ok) {
			setStatus("Unable to create import");
			return;
		}
		const data = await create.json();
		setImportId(data.id);
		setStatus(`Import ${data.id} queued`);
		await refresh();
	}

	async function handleUploadSingle() {
		if (!file) return;
		const isZip = file.name.toLowerCase().endsWith('.zip') || (file.type && /zip/i.test(file.type));
		await uploadBlob(file, file.name, isZip ? 'application/zip' : file.type || 'text/plain');
	}

	async function buildFolderZipFromEntries(entries: FolderEntry[]) {
		const zipCandidates = entries.filter((entry) => entry.path.toLowerCase().endsWith('.zip'));
		if (zipCandidates.length > 0) {
			const zipFile = zipCandidates[0].file;
			setFolderZip({ blob: zipFile, name: zipFile.name, numFiles: 1, size: zipFile.size, kind: 'zip' });
			setStatus(`ZIP archive detected: ${zipFile.name}`);
			return;
		}

		const txtEntries = entries.filter((entry) => entry.path.toLowerCase().endsWith('.txt'));
		if (txtEntries.length === 0) {
			setFolderZip(null);
			setStatus("No .txt files found in folder");
			return;
		}
		setStatus(`Preparing archive (${txtEntries.length} files)...`);
		const filesObj: Record<string, Uint8Array> = {};
		for (const { file: txtFile, path } of txtEntries) {
			const buf = new Uint8Array(await txtFile.arrayBuffer());
			filesObj[path] = buf;
		}
		const zipped = zipSync(filesObj, { level: 6 });
		const blob = new Blob([zipped], { type: 'application/zip' });
		setFolderZip({ blob, name: `hands-${Date.now()}.zip`, numFiles: txtEntries.length, size: blob.size, kind: 'folder' });
		setStatus(`Archive ready: ${txtEntries.length} files, ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
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
		await buildFolderZipFromEntries(entries);
	}

	async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault();
		const dt = event.dataTransfer;
		if (!dt) return;
		const entries = await extractFilesFromDataTransfer(dt);
		if (entries.length === 0) {
			setFolderZip(null);
			setStatus("No .txt files found in folder");
			return;
		}
		await buildFolderZipFromEntries(entries);
	}

	function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
		event.preventDefault();
	}

	async function handleUploadFolder() {
		if (!folderZip) return;
		await uploadBlob(folderZip.blob, folderZip.name, 'application/zip');
	}

	async function handleDeleteImport(id: string) {
		const confirmDelete = window.confirm('Delete this import?');
		if (!confirmDelete) return;
		setStatus("Deleting import...");
		const res = await fetch(`/api/imports/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			setStatus("Unable to delete import");
			return;
		}
		setStatus('Import deleted');
		await refresh();
	}

	return (
		<main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight text-foreground">Imports</h1>
				<p className="text-sm text-muted-foreground">
					Upload your Betclic Spin &amp; Go histories in seconds. Processing starts automatically.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader className="space-y-1">
						<CardTitle>Upload a file</CardTitle>
						<CardDescription>
							Select a <code>.txt</code> or <code>.zip</code> file. We detect the format automatically.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="file-upload">Hands file</Label>
							<Input
								id="file-upload"
								type="file"
								accept=".txt,.zip"
								onChange={(event) => setFile(event.target.files?.[0] ?? null)}
							/>
						</div>
						<Button
							className="w-full sm:w-auto"
							disabled={!file}
							onClick={handleUploadSingle}
							type="button"
						>
							Upload file
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="space-y-1">
						<CardTitle>Upload a folder</CardTitle>
						<CardDescription>
							Drag a folder with your <code>.txt</code> files—we bundle them into a ZIP automatically.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="folder-upload">Select a folder</Label>
							<Input
								id="folder-upload"
								type="file"
								multiple
								/* @ts-expect-error webkitdirectory non-typé */
								webkitdirectory=""
								onChange={handleFolderInput}
							/>
						</div>
						<div
							onDrop={handleDrop}
							onDragOver={handleDragOver}
							className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground transition hover:border-primary/60"
						>
							<strong className="text-foreground">Drag a folder here</strong>
							<span>
								We detect <code>.txt</code> files and build the ZIP archive.
							</span>
						</div>
						{folderZip && (
							<div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
								{folderZip.kind === 'zip' ? (
									<>
										ZIP archive detected: <span className="font-mono text-foreground">{folderZip.name}</span> • ~{folderZip.numFiles} file(s) • {(folderZip.size / (1024 * 1024)).toFixed(2)} MB
									</>
								) : (
									<>
										{folderZip.numFiles} files ready • ZIP {(folderZip.size / (1024 * 1024)).toFixed(2)} MB
									</>
								)}
							</div>
						)}
						<Button
							className="w-full sm:w-auto"
							variant="secondary"
							disabled={!folderZip}
							onClick={handleUploadFolder}
							type="button"
						>
							Send archive
						</Button>
					</CardContent>
				</Card>
			</div>

			{status && (
				<div className="rounded-md border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
					{status}
				</div>
			)}
			{importId && (
				<div className="text-xs text-muted-foreground">
					Import in progress: <span className="font-mono text-foreground">{importId}</span>
				</div>
			)}

			<Card>
				<CardHeader className="space-y-1">
					<CardTitle>Import history</CardTitle>
					<CardDescription>
						Track file status and remove entries you no longer need.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[160px]">ID</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Hands</TableHead>
								<TableHead>Created</TableHead>
								<TableHead>Completed</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
									<TableCell className="capitalize">{row.status}</TableCell>
									<TableCell>{row.numHands}</TableCell>
								<TableCell>{new Date(row.createdAt).toLocaleString("en-US")}</TableCell>
								<TableCell>{row.completedAt ? new Date(row.completedAt).toLocaleString("en-US") : '—'}</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="sm"
											type="button"
											className="text-destructive hover:text-destructive"
											onClick={() => handleDeleteImport(row.id)}
										>
											Delete
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{rows.length === 0 && (
						<div className="mt-6 rounded-md border border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
							No imports yet. Start by{' '}
							<Link href="/imports" className={buttonVariants({ variant: 'link' })}>
								uploading your files
							</Link>
							.
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
