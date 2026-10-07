import type { KnowledgeFolderView } from "@shared/types";
import { useEffect, useState } from "react";
import { Badge, Button, Dialog, DialogFooter, toast } from "@/design-system/components";
import { IconFolder, IconPlus, IconRefresh } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useKnowledge } from "@/stores/knowledge";

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
	return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function Progress({ done, total }: { done: number; total: number }) {
	const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
	return (
		<div
			role="progressbar"
			aria-label="Indexing progress"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={pct}
			className="h-1.5 w-full overflow-hidden rounded-full bg-active"
		>
			<div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
		</div>
	);
}

function FolderRow({ folder, onRemove }: { folder: KnowledgeFolderView; onRemove: () => void }) {
	const indexing = folder.status === "indexing" || folder.status === "queued";
	const skippedParts = [
		folder.skipped.pdf > 0
			? `${folder.skipped.pdf} PDF${folder.skipped.pdf === 1 ? "" : "s"} (PDFs aren't indexed yet)`
			: "",
		folder.skipped.tooLarge > 0 ? `${folder.skipped.tooLarge} over 2 MB` : "",
	].filter(Boolean);
	return (
		<li
			className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-elevated p-4"
			data-testid="knowledge-folder"
		>
			<div className="flex items-start gap-3">
				<IconFolder size={18} className="mt-0.5 shrink-0 text-fg-3" aria-hidden />
				<div className="min-w-0 flex-1">
					<div className="truncate text-md font-medium text-fg">{folder.name}</div>
					<div className="od-selectable truncate font-mono text-xs text-fg-3" title={folder.path}>
						{folder.path}
					</div>
				</div>
				{folder.status === "error" ? (
					<Badge variant="danger">Error</Badge>
				) : indexing ? (
					<Badge variant="info">Indexing</Badge>
				) : (
					<Badge variant="success">Ready</Badge>
				)}
			</div>
			{indexing && folder.progress && folder.progress.total > 0 && (
				<div className="flex flex-col gap-1">
					<Progress done={folder.progress.done} total={folder.progress.total} />
					<span className="text-xs text-fg-3">
						{folder.progress.done} of {folder.progress.total} files
					</span>
				</div>
			)}
			{folder.error && <p className="text-sm text-danger">{folder.error}</p>}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-2">
				<span data-testid="knowledge-file-count">
					{folder.fileCount} {folder.fileCount === 1 ? "file" : "files"}
				</span>
				<span>{formatBytes(folder.totalBytes)}</span>
				<span>{folder.lastIndexedAt ? `Indexed ${relativeTime(folder.lastIndexedAt)}` : "Not indexed yet"}</span>
			</div>
			{skippedParts.length > 0 && <p className="text-xs text-fg-3">Skipped: {skippedParts.join(", ")}.</p>}
			<div className="flex gap-2">
				<Button
					size="sm"
					variant="secondary"
					leadingIcon={<IconRefresh size={14} />}
					disabled={indexing}
					onClick={() =>
						void api.knowledge
							.reindex(folder.id, true)
							.catch((e) => toast({ title: "Couldn't re-index", description: errorText(e), variant: "error" }))
					}
				>
					Re-index
				</Button>
				<Button size="sm" variant="ghost" onClick={onRemove}>
					Remove
				</Button>
			</div>
		</li>
	);
}

export function KnowledgePanel() {
	const folders = useKnowledge((s) => s.folders);
	const [busy, setBusy] = useState(false);
	const [removing, setRemoving] = useState<KnowledgeFolderView | undefined>();

	useEffect(() => {
		void useKnowledge
			.getState()
			.load()
			.catch(() => undefined);
	}, []);

	const add = async () => {
		setBusy(true);
		try {
			const p = await api.app.pickFolder({ title: "Choose a folder of notes or documents" });
			if (p) await api.knowledge.addFolder(p);
		} catch (e) {
			toast({ title: "Couldn't add the folder", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="flex flex-col gap-3" data-testid="knowledge-panel">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h3 className="text-lg font-semibold text-fg">Folders</h3>
					<p className="text-sm text-fg-2">
						OpenDot indexes these on this computer. A passage only goes to a Dot's model when that Dot searches and uses
						it in a chat.
					</p>
				</div>
				<Button size="sm" leadingIcon={<IconPlus size={14} />} loading={busy} onClick={() => void add()}>
					Add folder
				</Button>
			</div>
			{folders.length === 0 ? (
				<p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-2">
					No folders yet. Add a folder of notes, Markdown, text, HTML or code and your Dots can search it.
				</p>
			) : (
				<ul className="flex flex-col gap-3">
					{folders.map((f) => (
						<FolderRow key={f.id} folder={f} onRemove={() => setRemoving(f)} />
					))}
				</ul>
			)}
			<p className="text-xs text-fg-3">
				Indexed: Markdown, text, reStructuredText, Org, CSV, JSON, HTML and common source code. Hidden folders,
				node_modules, files over 2 MB and binaries are skipped. PDFs aren't indexed yet.
			</p>
			<Dialog
				open={!!removing}
				onOpenChange={(o) => !o && setRemoving(undefined)}
				size="sm"
				title={`Stop indexing ${removing?.name ?? "this folder"}?`}
				description="Your files stay where they are. Only OpenDot's search index for this folder is deleted."
				footer={
					<DialogFooter>
						<Button variant="ghost" onClick={() => setRemoving(undefined)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={() => {
								const id = removing?.id;
								setRemoving(undefined);
								if (id)
									void api.knowledge
										.removeFolder(id)
										.catch((e) => toast({ title: "Couldn't remove", description: errorText(e), variant: "error" }));
							}}
						>
							Remove
						</Button>
					</DialogFooter>
				}
			>
				<p className="text-sm text-fg-2">Dots will no longer find anything from it.</p>
			</Dialog>
		</section>
	);
}
