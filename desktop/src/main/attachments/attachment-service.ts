// Chat attachments (main side): staging, limits, inlining, workspace copies, media serving.
// The renderer never hands over a path to read: files arrive as bytes (drop/paste) or through the native file
// picker (a path chosen in main), and are referenced afterwards only by the random id returned here.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import {
	ATTACHMENTS_DIR,
	composeUserText,
	detectKind,
	extOf,
	FOLDER_MESSAGE,
	formatAttachmentBlock,
	formatBytes,
	INLINE_MAX_CHARS,
	imageMimeOf,
	looksBinary,
	MAX_ATTACHMENTS,
	safeFileName,
	sizeError,
	sniffImageMime,
	TOO_MANY_MESSAGE,
	truncateForInline,
	workspaceCopyName,
} from "../../shared/attachments";
import { OpenDotError } from "../../shared/errors";
import type { AttachmentDraft, AttachmentKind, AttachmentStageResult, Dot } from "../../shared/types";
import { log } from "../log";
import type { Paths } from "../paths";

export interface AttachmentItem {
	name: string;
	kind: AttachmentKind;
	mime: string;
	bytes: Uint8Array;
}

export interface RenderedMessage {
	/** What the model receives as the user message text: typed text plus one block per attachment. */
	text: string;
	/** Image content for the model (empty when it can't see images or they go as file references). */
	images: Array<{ type: "image"; data: string; mimeType: string }>;
}

interface Staged {
	name: string;
	kind: AttachmentKind;
	mime: string;
	size: number;
	file: string;
}

export interface AttachmentServiceDeps {
	paths: Paths;
	/** Whether the Dot's model accepts image input. */
	supportsImages: (dot: Dot) => Promise<boolean>;
}

const ID_RE = /^att_[0-9a-f-]{36}$/;
const IMAGE_SERVE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

export class AttachmentService {
	private staged = new Map<string, Staged>();
	/** Test hook: file lists the next native picker calls return (OPENDOT_E2E only). */
	testPicks: string[][] = [];

	constructor(private readonly deps: AttachmentServiceDeps) {
		// Drafts do not survive a restart; drop whatever a crash left behind.
		void rm(this.stagingDir, { recursive: true, force: true }).catch(() => undefined);
	}

	get stagingDir(): string {
		return join(this.deps.paths.root, "tmp", "attachments");
	}

	// ───────────── staging ─────────────
	async stageBytes(
		input: { name: string; mime?: string; data: Uint8Array },
		existing = 0,
	): Promise<AttachmentStageResult> {
		const name = safeFileName(String(input.name || "file"));
		if (existing >= MAX_ATTACHMENTS) return { ok: false, name, error: TOO_MANY_MESSAGE };
		const bytes = input.data instanceof Uint8Array ? input.data : new Uint8Array();
		return this.stage(name, input.mime ?? "", bytes);
	}

	async stagePath(path: string, existing = 0): Promise<AttachmentStageResult> {
		const name = safeFileName(basename(path));
		if (existing >= MAX_ATTACHMENTS) return { ok: false, name, error: TOO_MANY_MESSAGE };
		try {
			const st = await stat(path);
			if (st.isDirectory()) return { ok: false, name, error: FOLDER_MESSAGE };
			if (!st.isFile()) return { ok: false, name, error: `${name} can't be attached.` };
			const kind = detectKind(name);
			const tooBig = sizeError(name, kind, st.size);
			if (tooBig) return { ok: false, name, error: tooBig };
			return this.stage(name, "", new Uint8Array(await readFile(path)));
		} catch (e) {
			log.warn("attachment read failed", (e as Error).message);
			return { ok: false, name, error: `Couldn't read ${name}.` };
		}
	}

	private async stage(name: string, mime: string, bytes: Uint8Array): Promise<AttachmentStageResult> {
		let kind = detectKind(name, mime);
		if (kind === "image") {
			// Trust the bytes, not the extension.
			if (!sniffImageMime(bytes)) kind = "file";
		} else if (kind === "text" && looksBinary(bytes)) kind = "file";
		const tooBig = sizeError(name, kind, bytes.length);
		if (tooBig) return { ok: false, name, error: tooBig };
		if (bytes.length === 0) return { ok: false, name, error: `${name} is empty.` };
		const id = `att_${randomUUID()}`;
		const file = join(
			this.stagingDir,
			`${id}${extname(name)
				.slice(0, 12)
				.replace(/[^.\w]/g, "")}`,
		);
		await mkdir(this.stagingDir, { recursive: true });
		await writeFile(file, bytes, { mode: 0o600 });
		const resolvedMime =
			kind === "image" ? (sniffImageMime(bytes) ?? imageMimeOf(name) ?? mime) : mime || guessMime(name);
		this.staged.set(id, { name, kind, mime: resolvedMime, size: bytes.length, file });
		const attachment: AttachmentDraft = {
			id,
			name,
			kind,
			mime: resolvedMime,
			size: bytes.length,
			previewUrl: kind === "image" ? `opendot-media://x/staged/${id}` : undefined,
		};
		return { ok: true, attachment };
	}

	async discard(id: string): Promise<void> {
		const s = this.staged.get(id);
		if (!s) return;
		this.staged.delete(id);
		await rm(s.file, { force: true }).catch(() => undefined);
	}

	supportsImages(dot: Dot): Promise<boolean> {
		return this.deps.supportsImages(dot);
	}

	/** Kinds of staged files, in order (throws when one is gone). */
	kindsOf(ids: string[]): AttachmentKind[] {
		return ids.map((id) => {
			const s = ID_RE.test(id) ? this.staged.get(id) : undefined;
			if (!s) throw new OpenDotError("NOT_FOUND", "An attachment is no longer available. Add it again.");
			return s.kind;
		});
	}

	/** Load staged files for a send (and forget them: they now live in the workspace). */
	async take(ids: string[]): Promise<AttachmentItem[]> {
		if (ids.length > MAX_ATTACHMENTS) throw new OpenDotError("INVALID_ARGS", TOO_MANY_MESSAGE);
		const items: AttachmentItem[] = [];
		for (const id of ids) {
			const s = ID_RE.test(id) ? this.staged.get(id) : undefined;
			if (!s) throw new OpenDotError("NOT_FOUND", "An attachment is no longer available. Add it again.");
			items.push({ name: s.name, kind: s.kind, mime: s.mime, bytes: new Uint8Array(await readFile(s.file)) });
		}
		for (const id of ids) await this.discard(id);
		return items;
	}

	// ───────────── building the message ─────────────
	/**
	 * Copy files into the Dot's workspace and build the user message.
	 * `imagesAsFiles`: send images as workspace file references only (the model gets no pixels).
	 */
	async render(
		dot: Dot,
		typed: string,
		items: AttachmentItem[],
		opts: { supportsImages: boolean; imagesAsFiles?: boolean },
	): Promise<RenderedMessage> {
		const dir = join(dot.workspaceDir, ATTACHMENTS_DIR);
		await mkdir(dir, { recursive: true });
		const ts = Date.now();
		const blocks: string[] = [];
		const images: RenderedMessage["images"] = [];
		for (const it of items) {
			const copyName = await this.writeCopy(dir, ts, it);
			const path = `${ATTACHMENTS_DIR}/${copyName}`;
			const size = it.bytes.length;
			if (it.kind === "text") {
				const decoded = new TextDecoder("utf-8").decode(it.bytes).replace(/^﻿/, "");
				const cut = truncateForInline(decoded);
				const note = cut.truncated
					? `\n[Truncated: showing the first ${INLINE_MAX_CHARS.toLocaleString("en-US")} of ${decoded.length.toLocaleString("en-US")} characters. The full file is at ${path} in your workspace.]`
					: "";
				blocks.push(
					formatAttachmentBlock(
						{ name: it.name, kind: "text", mime: it.mime, size, path, truncated: cut.truncated || undefined },
						`${cut.text}${note}`,
					),
				);
			} else if (it.kind === "image") {
				const asRef = !opts.supportsImages || !!opts.imagesAsFiles;
				if (!asRef) images.push({ type: "image", data: Buffer.from(it.bytes).toString("base64"), mimeType: it.mime });
				blocks.push(
					formatAttachmentBlock(
						{ name: it.name, kind: "image", mime: it.mime, size, path, asReference: asRef || undefined },
						asRef
							? `Image attached as a file reference: ${it.name}. You can't see it. A copy is saved at ${path} in your workspace.`
							: `Image attached: ${it.name}. A copy is saved at ${path} in your workspace.`,
					),
				);
			} else {
				blocks.push(
					formatAttachmentBlock(
						{ name: it.name, kind: "file", mime: it.mime, size, path },
						`File attached: ${it.name} (${formatBytes(size)}). It is saved at ${path} in your workspace. Read it with your file tools if you need its content.`,
					),
				);
			}
		}
		return { text: composeUserText(typed, blocks), images };
	}

	private async writeCopy(dir: string, ts: number, it: AttachmentItem): Promise<string> {
		for (let attempt = 0; attempt < 50; attempt++) {
			const name = workspaceCopyName(ts, it.name, attempt);
			const target = join(dir, name);
			if (existsSync(target)) continue;
			await writeFile(target, it.bytes, { flag: "wx", mode: 0o600 }).catch((e: NodeJS.ErrnoException) => {
				if (e.code !== "EEXIST") throw e;
			});
			return name;
		}
		throw new OpenDotError("ERROR", "Couldn't save the attachment to the workspace.");
	}

	// ───────────── paths and media ─────────────
	/** Absolute path of a workspace attachment, or undefined when `rel` is not exactly `attachments/<file>`. */
	resolveWorkspaceFile(workspaceDir: string, rel: string): string | undefined {
		return guardAttachmentPath(workspaceDir, rel);
	}

	/** Resolve an opendot-media:// URL to a file we are willing to serve (images only). */
	async resolveMedia(
		url: string,
		workspaceOf: (dotId: string) => Promise<string | undefined>,
	): Promise<{ file: string; mime: string } | undefined> {
		let u: URL;
		try {
			u = new URL(url);
		} catch {
			return undefined;
		}
		if (u.protocol !== "opendot-media:") return undefined;
		const parts = u.pathname.split("/").filter(Boolean).map(safeDecode);
		if (parts.some((p) => p === undefined)) return undefined;
		const segs = parts as string[];
		if (segs[0] === "staged" && segs.length === 2) {
			const s = ID_RE.test(segs[1]!) ? this.staged.get(segs[1]!) : undefined;
			return s && s.kind === "image" ? { file: s.file, mime: s.mime } : undefined;
		}
		if (segs[0] === "dot" && segs.length === 3) {
			const ws = await workspaceOf(segs[1]!);
			if (!ws) return undefined;
			const file = guardAttachmentPath(ws, `${ATTACHMENTS_DIR}/${segs[2]!}`);
			const ext = file ? extOf(file) : "";
			if (!file || !IMAGE_SERVE_EXT.has(ext)) return undefined;
			return { file, mime: imageMimeOf(file) ?? "application/octet-stream" };
		}
		return undefined;
	}

	/** Make sure the workspace attachments dir exists (used by tests). */
	ensureDir(workspaceDir: string): void {
		mkdirSync(join(workspaceDir, ATTACHMENTS_DIR), { recursive: true });
	}
}

/** `attachments/<file>` inside `workspaceDir`, nothing else. */
export function guardAttachmentPath(workspaceDir: string, rel: string): string | undefined {
	const norm = rel.replace(/\\/g, "/");
	const m = /^attachments\/([^/]+)$/.exec(norm);
	if (!m) return undefined;
	const name = m[1]!;
	if (name === "." || name === ".." || name.includes("\0")) return undefined;
	const base = resolve(workspaceDir, ATTACHMENTS_DIR);
	const file = resolve(base, name);
	return file.startsWith(base + sep) ? file : undefined;
}

function safeDecode(s: string): string | undefined {
	try {
		return decodeURIComponent(s);
	} catch {
		return undefined;
	}
}

function guessMime(name: string): string {
	const ext = extOf(name);
	const map: Record<string, string> = {
		pdf: "application/pdf",
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		zip: "application/zip",
		json: "application/json",
		csv: "text/csv",
		md: "text/markdown",
		txt: "text/plain",
	};
	return map[ext] ?? "application/octet-stream";
}
