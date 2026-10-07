// Files waiting in each Dot's composer (staged in main, referenced by id).
import { detectKind, FOLDER_MESSAGE, MAX_ATTACHMENTS, sizeError, TOO_MANY_MESSAGE } from "@shared/attachments";
import type { AttachmentDraft, AttachmentStageResult, DotId } from "@shared/types";
import { create } from "zustand";
import { toast } from "../design-system/components";
import { api, errorText } from "../lib/api";

/** A dropped or pasted entry; `isDir` is read synchronously during the drop. */
export interface IncomingFile {
	file: File;
	isDir?: boolean;
}

interface AttachmentsState {
	byDot: Record<string, AttachmentDraft[]>;
	/** The user chose to send images as file references for this Dot's next message. */
	asFiles: Record<string, boolean>;
	addFiles(dotId: DotId, files: IncomingFile[]): Promise<void>;
	pick(dotId: DotId): Promise<void>;
	remove(dotId: DotId, id: string): void;
	/** Forget drafts after a send (main already consumed them). */
	clear(dotId: DotId): void;
	setAsFiles(dotId: DotId, on: boolean): void;
}

const EMPTY: AttachmentDraft[] = [];
export const draftsOf = (s: AttachmentsState, dotId: DotId): AttachmentDraft[] => s.byDot[dotId] ?? EMPTY;

function report(results: AttachmentStageResult[]): void {
	const errors = results.filter((r): r is Extract<AttachmentStageResult, { ok: false }> => !r.ok).map((r) => r.error);
	for (const msg of [...new Set(errors)]) toast({ title: msg, variant: "error" });
}

export const useAttachments = create<AttachmentsState>((set, get) => {
	const append = (dotId: DotId, list: AttachmentDraft[]) => {
		if (list.length === 0) return;
		set((s) => ({ byDot: { ...s.byDot, [dotId]: [...(s.byDot[dotId] ?? []), ...list] } }));
	};
	return {
		byDot: {},
		asFiles: {},

		async addFiles(dotId, files) {
			const results: AttachmentStageResult[] = [];
			const added: AttachmentDraft[] = [];
			let count = draftsOf(get(), dotId).length;
			for (const { file, isDir } of files) {
				if (isDir) {
					results.push({ ok: false, name: file.name, error: FOLDER_MESSAGE });
					continue;
				}
				if (count >= MAX_ATTACHMENTS) {
					results.push({ ok: false, name: file.name, error: TOO_MANY_MESSAGE });
					continue;
				}
				const early = sizeError(file.name, detectKind(file.name, file.type), file.size);
				if (early) {
					results.push({ ok: false, name: file.name, error: early });
					continue;
				}
				try {
					const data = new Uint8Array(await file.arrayBuffer());
					const r = await api.attachments.stage({ name: file.name, mime: file.type, data, existing: count });
					if (r.ok) {
						count++;
						const previewUrl = r.attachment.kind === "image" ? URL.createObjectURL(file) : undefined;
						added.push({ ...r.attachment, previewUrl: previewUrl ?? r.attachment.previewUrl });
					} else results.push(r);
				} catch (e) {
					results.push({ ok: false, name: file.name, error: errorText(e) });
				}
			}
			append(dotId, added);
			report(results);
		},

		async pick(dotId) {
			try {
				const results = await api.attachments.pick({ existing: draftsOf(get(), dotId).length });
				append(
					dotId,
					results.flatMap((r) => (r.ok ? [r.attachment] : [])),
				);
				report(results);
			} catch (e) {
				toast({ title: errorText(e), variant: "error" });
			}
		},

		remove(dotId, id) {
			const gone = draftsOf(get(), dotId).find((d) => d.id === id);
			if (gone?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(gone.previewUrl);
			void api.attachments.discard(id).catch(() => undefined);
			set((s) => ({ byDot: { ...s.byDot, [dotId]: draftsOf(s, dotId).filter((d) => d.id !== id) } }));
		},

		clear(dotId) {
			set((s) => ({ byDot: { ...s.byDot, [dotId]: [] }, asFiles: { ...s.asFiles, [dotId]: false } }));
		},

		setAsFiles(dotId, on) {
			set((s) => ({ asFiles: { ...s.asFiles, [dotId]: on } }));
		},
	};
});

/** Entries of a drop, with folders flagged. Must run synchronously inside the drop handler. */
export function incomingFromDrop(dt: DataTransfer): IncomingFile[] {
	const out: IncomingFile[] = [];
	const items = Array.from(dt.items ?? []);
	if (items.length > 0 && items.some((i) => i.kind === "file")) {
		for (const item of items) {
			if (item.kind !== "file") continue;
			const file = item.getAsFile();
			if (!file) continue;
			const entry = (
				item as DataTransferItem & { webkitGetAsEntry?: () => { isDirectory?: boolean } | null }
			).webkitGetAsEntry?.();
			out.push({ file, isDir: !!entry?.isDirectory });
		}
		return out;
	}
	return Array.from(dt.files ?? []).map((file) => ({ file }));
}

/** Pasted files (screenshots, copied images). Unnamed images get a unique name. */
export function incomingFromPaste(dt: DataTransfer | null): IncomingFile[] {
	if (!dt) return [];
	const files = Array.from(dt.files ?? []);
	return files.map((f, i) => {
		if (f.type.startsWith("image/") && /^image\.\w+$/i.test(f.name)) {
			const ext = f.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
			const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
			return { file: new File([f], `pasted-${stamp}${i ? `-${i + 1}` : ""}.${ext}`, { type: f.type }) };
		}
		return { file: f };
	});
}
