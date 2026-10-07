// Attachment UI: composer tray, message thumbnails/chips, lightbox and the drop overlay.
import { formatBytes, IMAGE_ATTACH_TOOLTIP } from "@shared/attachments";
import type { AttachmentDraft, AttachmentView, DotId } from "@shared/types";
import { useState } from "react";
import { cn } from "../../design-system/cn";
import { Dialog, toast } from "../../design-system/components";
import { IconClose, IconExternal, IconFile, IconFileText, IconPaperclip, IconWarning } from "../../design-system/icons";
import { api, errorText } from "../../lib/api";

export { IMAGE_ATTACH_TOOLTIP };

function KindIcon({ kind }: { kind: AttachmentDraft["kind"] }) {
	return kind === "text" ? <IconFileText size={16} /> : <IconFile size={16} />;
}

/** Removable thumbnails and chips above the input. */
export function ComposerTray({
	drafts,
	onRemove,
	warning,
}: {
	drafts: AttachmentDraft[];
	onRemove: (id: string) => void;
	warning?: React.ReactNode;
}) {
	if (drafts.length === 0) return null;
	return (
		<div className="mx-auto mb-2 w-full max-w-[var(--od-chat-max-w)]">
			<ul aria-label="Attachments" className="flex flex-wrap gap-2">
				{drafts.map((d) => (
					<li
						key={d.id}
						data-testid="attachment-draft"
						className="group relative flex items-center overflow-hidden rounded-lg border border-border bg-elevated"
					>
						{d.kind === "image" && d.previewUrl ? (
							<img src={d.previewUrl} alt={d.name} className="h-14 w-14 object-cover" />
						) : (
							<span className="flex h-14 max-w-48 items-center gap-2 px-3 text-sm text-fg">
								<span className="text-fg-3">
									<KindIcon kind={d.kind} />
								</span>
								<span className="min-w-0">
									<span className="block truncate">{d.name}</span>
									<span className="block text-2xs text-fg-3">{formatBytes(d.size)}</span>
								</span>
							</span>
						)}
						<button
							type="button"
							aria-label={`Remove ${d.name}`}
							onClick={() => onRemove(d.id)}
							className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-elevated text-fg-2 opacity-90 shadow-sm hover:bg-hover hover:text-fg"
						>
							<IconClose size={12} />
						</button>
					</li>
				))}
			</ul>
			{warning}
		</div>
	);
}

/** Shown when the model can't see images. */
export function ImageWarning({ asFiles, onChange }: { asFiles: boolean; onChange: (on: boolean) => void }) {
	return (
		<div
			role="status"
			className={cn(
				"mt-2 flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
				asFiles ? "bg-elevated text-fg-2" : "bg-warning-subtle text-warning",
			)}
		>
			<IconWarning size={14} />
			<span>{asFiles ? "Images will be sent as file references" : "This model can't see images"}</span>
			<button
				type="button"
				onClick={() => onChange(!asFiles)}
				className="font-medium underline-offset-2 hover:underline"
			>
				{asFiles ? "Undo" : "Send as file references"}
			</button>
		</div>
	);
}

export function AttachButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label="Attach files"
			title={IMAGE_ATTACH_TOOLTIP}
			className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-2 transition-colors hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
		>
			<IconPaperclip size={18} />
		</button>
	);
}

export function DropOverlay() {
	return (
		<div
			aria-hidden="true"
			data-testid="drop-overlay"
			className="pointer-events-none absolute inset-0 z-popover flex items-center justify-center bg-overlay"
		>
			<div className="rounded-xl border-2 border-dashed border-accent bg-elevated px-8 py-6 text-md font-medium text-fg shadow-lg">
				Drop to add to the chat
			</div>
		</div>
	);
}

async function openFile(dotId: DotId, a: AttachmentView, reveal: boolean): Promise<void> {
	if (!a.path) return;
	try {
		await api.attachments.open(dotId, a.path, reveal);
	} catch (e) {
		toast({ title: errorText(e), variant: "error" });
	}
}

/** Thumbnails (click: lightbox) and file chips (click: open, small button: show in folder). */
export function MessageAttachments({ dotId, attachments }: { dotId: DotId; attachments: AttachmentView[] }) {
	const [zoom, setZoom] = useState<AttachmentView | undefined>();
	const images = attachments.filter((a) => a.kind === "image" && a.url);
	const files = attachments.filter((a) => !(a.kind === "image" && a.url));
	return (
		<div className="mb-1.5 flex flex-col gap-1.5" data-testid="message-attachments">
			{images.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{images.map((a) => (
						<button
							key={`${a.path ?? a.url}`}
							type="button"
							aria-label={`View ${a.name}`}
							onClick={() => setZoom(a)}
							className="overflow-hidden rounded-md bg-black/5 focus-visible:outline-2"
						>
							<img
								src={a.url}
								alt={a.name}
								className={cn("object-cover", images.length === 1 ? "max-h-56 max-w-full" : "h-24 w-24")}
							/>
						</button>
					))}
				</div>
			)}
			{files.map((a) => (
				<div
					key={`${a.path ?? a.name}`}
					className="flex items-center gap-1 rounded-md bg-black/5 pr-1 text-sm dark:bg-white/5"
				>
					<button
						type="button"
						onClick={() => void openFile(dotId, a, false)}
						title={`Open ${a.name}`}
						className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
					>
						<span className="text-fg-3">
							<KindIcon kind={a.kind} />
						</span>
						<span className="min-w-0">
							<span className="block truncate">{a.name}</span>
							<span className="block text-2xs text-fg-3">
								{[
									a.size !== undefined ? formatBytes(a.size) : undefined,
									a.kind === "image" ? "file reference" : undefined,
									a.truncated ? "shortened" : undefined,
								]
									.filter(Boolean)
									.join(" · ")}
							</span>
						</span>
					</button>
					<button
						type="button"
						aria-label={`Show ${a.name} in folder`}
						title="Show in folder"
						onClick={() => void openFile(dotId, a, true)}
						className="rounded-sm p-1 text-fg-3 hover:bg-hover hover:text-fg"
					>
						<IconExternal size={13} />
					</button>
				</div>
			))}
			<Dialog
				open={!!zoom}
				onOpenChange={(o) => !o && setZoom(undefined)}
				title={zoom?.name ?? ""}
				size="lg"
				footer={null}
			>
				{zoom?.url && <img src={zoom.url} alt={zoom.name} className="mx-auto max-h-[65vh] max-w-full object-contain" />}
			</Dialog>
		</div>
	);
}
