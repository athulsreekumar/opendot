// Local knowledge base: indexes folders of notes and documents under ~/.opendot/knowledge and answers searches.
// BM25 only (no embeddings). Incremental by mtime + size; watches folders for changes. Never reads file contents into logs.

import { randomBytes } from "node:crypto";
import { type FSWatcher, watch } from "node:fs";
import { mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { OpenDotError } from "../../shared/errors";
import type { KnowledgeFolderView, KnowledgeState } from "../../shared/types";
import { expandTilde } from "../connections/mac/path-guard";
import { log } from "../log";
import { type Chunk, chunkText, htmlToText } from "./chunker";
import { classifyFile, hasIgnoredSegment, looksBinary, MAX_FILE_BYTES } from "./filter";
import { resolveKnowledgeFile } from "./path-guard";
import { scanFolder, yieldNow } from "./scanner";
import { Bm25Index } from "./search";

export const MAX_FOLDERS = 20;
const MAX_READ_LINES = 400;
const MAX_READ_CHARS = 24_000;
const SNIPPET_CHARS = 700;
const MAX_PER_FILE = 2;

export interface KnowledgeHit {
	path: string;
	name: string;
	heading: string;
	startLine: number;
	endLine: number;
	snippet: string;
	score: number;
}

export interface KnowledgeReadResult {
	path: string;
	name: string;
	text: string;
	startLine: number;
	endLine: number;
	totalLines: number;
	truncated: boolean;
}

export interface KnowledgeDeps {
	/** ~/.opendot/knowledge */
	dir: string;
	emit(state: KnowledgeState): void;
	/** Watch folders for changes (off in unit tests). */
	watch?: boolean;
	watchDebounceMs?: number;
}

interface ChunkRec {
	folderId: string;
	rel: string;
	heading: string;
	startLine: number;
	endLine: number;
	text: string;
}

interface FileRec {
	size: number;
	mtimeMs: number;
	ids: number[];
}

interface Folder {
	id: string;
	path: string;
	name: string;
	addedAt: string;
	lastIndexedAt?: string;
	status: KnowledgeFolderView["status"];
	error?: string;
	progress?: { done: number; total: number };
	files: Map<string, FileRec>;
	skipped: KnowledgeFolderView["skipped"];
	running?: Promise<void>;
	again: boolean;
	againFull: boolean;
	removed: boolean;
	watcher?: FSWatcher;
	timer?: NodeJS.Timeout;
}

interface StoredFolders {
	version: 1;
	folders: Array<{ id: string; path: string; addedAt: string; lastIndexedAt?: string }>;
}
interface StoredIndex {
	version: 1;
	skipped?: KnowledgeFolderView["skipped"];
	files: Record<
		string,
		{ size: number; mtimeMs: number; chunks: Array<{ h: string; s: number; e: number; t: string }> }
	>;
}

const indexText = (rel: string, heading: string, text: string) =>
	`${basename(rel).replace(/\.[^.]+$/, "")} ${heading} ${heading} ${text}`;

export class KnowledgeService {
	private readonly folders = new Map<string, Folder>();
	private readonly chunks = new Map<number, ChunkRec>();
	private readonly index = new Bm25Index();
	private nextId = 1;
	private ready: Promise<void> = Promise.resolve();
	private writes: Promise<unknown> = Promise.resolve();
	private emitTimer: NodeJS.Timeout | undefined;
	private stopped = false;

	constructor(private readonly deps: KnowledgeDeps) {}

	// ── lifecycle ──
	/** Loads the saved index, then brings every folder up to date. Resolves when loading is done (indexing continues). */
	start(): Promise<void> {
		this.ready = this.load().catch((e) => log.warn("knowledge load failed", (e as Error).message));
		return this.ready.then(() => {
			for (const f of this.folders.values()) {
				if (this.deps.watch !== false) this.watchFolder(f);
				void this.reindex(f.id).catch(() => undefined);
			}
		});
	}

	async stop(): Promise<void> {
		this.stopped = true;
		if (this.emitTimer) clearTimeout(this.emitTimer);
		for (const f of this.folders.values()) {
			f.watcher?.close();
			if (f.timer) clearTimeout(f.timer);
		}
		await Promise.allSettled([...this.folders.values()].map((f) => f.running));
		await this.writes.catch(() => undefined);
	}

	// ── state ──
	state(): KnowledgeState {
		return { folders: [...this.folders.values()].map((f) => this.view(f)) };
	}

	private view(f: Folder): KnowledgeFolderView {
		let fileCount = 0;
		let chunkCount = 0;
		let totalBytes = 0;
		for (const r of f.files.values()) {
			if (!r.ids.length) continue;
			fileCount++;
			chunkCount += r.ids.length;
			totalBytes += r.size;
		}
		return {
			id: f.id,
			path: f.path,
			name: f.name,
			status: f.status,
			fileCount,
			chunkCount,
			totalBytes,
			lastIndexedAt: f.lastIndexedAt,
			progress: f.status === "indexing" ? f.progress : undefined,
			error: f.error,
			skipped: f.skipped,
		};
	}

	private emit(now = false): void {
		if (this.stopped) return;
		if (now) {
			if (this.emitTimer) clearTimeout(this.emitTimer);
			this.emitTimer = undefined;
			this.deps.emit(this.state());
			return;
		}
		if (this.emitTimer) return;
		this.emitTimer = setTimeout(() => {
			this.emitTimer = undefined;
			if (!this.stopped) this.deps.emit(this.state());
		}, 120);
	}

	roots(): string[] {
		return [...this.folders.values()].map((f) => f.path);
	}

	/** True while any folder is being indexed (search results may be incomplete). */
	busy(): boolean {
		return [...this.folders.values()].some((f) => f.status === "indexing" || f.status === "queued");
	}

	// ── folders ──
	async addFolder(input: string): Promise<KnowledgeFolderView> {
		await this.ready;
		let abs: string;
		try {
			abs = await realpath(resolve(expandTilde(input)));
			if (!(await stat(abs)).isDirectory()) throw new Error("not a folder");
		} catch {
			throw new OpenDotError("INVALID", "That isn't a folder OpenDot can read.");
		}
		const same = (a: string, b: string) =>
			process.platform === "linux" ? a === b : a.toLowerCase() === b.toLowerCase();
		const inside = (root: string, p: string) => {
			const sep = process.platform === "win32" ? "\\" : "/";
			const r = root.endsWith(sep) ? root : root + sep;
			return same(p.slice(0, r.length), r);
		};
		for (const f of this.folders.values()) {
			if (same(f.path, abs)) return this.view(f);
			if (inside(f.path, abs)) throw new OpenDotError("INVALID", `That folder is already covered by ${f.name}.`);
		}
		if (this.folders.size >= MAX_FOLDERS)
			throw new OpenDotError("LIMIT", `You can index up to ${MAX_FOLDERS} folders.`);
		// A parent replaces the folders it contains.
		for (const f of [...this.folders.values()]) if (inside(abs, f.path)) await this.removeFolder(f.id);
		const f: Folder = {
			id: `kfd_${randomBytes(6).toString("hex")}`,
			path: abs,
			name: basename(abs) || abs,
			addedAt: new Date().toISOString(),
			status: "queued",
			files: new Map(),
			skipped: { pdf: 0, tooLarge: 0, other: 0 },
			again: false,
			againFull: false,
			removed: false,
		};
		this.folders.set(f.id, f);
		this.saveFolders();
		if (this.deps.watch !== false) this.watchFolder(f);
		this.emit(true);
		void this.reindex(f.id).catch(() => undefined);
		return this.view(f);
	}

	async removeFolder(id: string): Promise<void> {
		const f = this.folders.get(id);
		if (!f) return;
		f.removed = true;
		f.watcher?.close();
		if (f.timer) clearTimeout(f.timer);
		for (const rec of f.files.values()) this.dropChunks(rec.ids);
		this.folders.delete(id);
		this.saveFolders();
		this.enqueueWrite(() => rm(this.indexFile(id), { force: true }));
		this.emit(true);
	}

	/** Re-scan a folder (or all). `full` re-reads every file instead of only changed ones. */
	async reindex(id?: string, full = false): Promise<void> {
		await this.ready;
		const list = id ? [this.folders.get(id)] : [...this.folders.values()];
		await Promise.all(list.map((f) => (f ? this.run(f, full) : undefined)));
	}

	private run(f: Folder, full: boolean): Promise<void> {
		if (f.running) {
			f.again = true;
			f.againFull ||= full;
			return f.running;
		}
		f.running = (async () => {
			let fullNext = full;
			try {
				do {
					f.again = false;
					f.againFull = false;
					await this.indexOnce(f, fullNext);
					fullNext = f.againFull;
				} while (f.again && !f.removed && !this.stopped);
			} catch (e) {
				f.status = "error";
				f.error = "Couldn't index this folder.";
				log.warn("knowledge index failed", (e as Error).message);
			} finally {
				f.running = undefined;
				this.emit(true);
			}
		})();
		return f.running;
	}

	private async indexOnce(f: Folder, full: boolean): Promise<void> {
		f.status = "indexing";
		f.error = undefined;
		f.progress = { done: 0, total: 0 };
		this.emit(true);
		let scan: Awaited<ReturnType<typeof scanFolder>>;
		try {
			scan = await scanFolder(f.path, () => f.removed || this.stopped);
		} catch {
			f.status = "error";
			f.error = "This folder can't be found or read. Is it still there?";
			f.progress = undefined;
			return;
		}
		if (f.removed || this.stopped) return;
		const seen = new Set(scan.files.map((x) => x.rel));
		for (const [rel, rec] of [...f.files]) {
			if (!seen.has(rel)) {
				this.dropChunks(rec.ids);
				f.files.delete(rel);
			}
		}
		const todo = scan.files.filter((x) => {
			const prev = f.files.get(x.rel);
			return full || !prev || prev.size !== x.size || prev.mtimeMs !== x.mtimeMs;
		});
		f.progress = { done: 0, total: todo.length };
		let unreadable = 0;
		let sliceStart = Date.now();
		for (const file of todo) {
			if (f.removed || this.stopped) return;
			const prev = f.files.get(file.rel);
			if (prev) this.dropChunks(prev.ids);
			let ids: number[] = [];
			try {
				const buf = await readFile(file.abs);
				if (buf.length <= MAX_FILE_BYTES && !looksBinary(buf)) {
					ids = this.addChunks(f, file.rel, chunkText(buf.toString("utf8").replace(/^﻿/, ""), file.kind));
				}
			} catch {
				// unreadable: recorded below with no chunks
			}
			f.files.set(file.rel, { size: file.size, mtimeMs: file.mtimeMs, ids });
			f.progress.done++;
			if (Date.now() - sliceStart > 8) {
				this.emit();
				await yieldNow();
				sliceStart = Date.now();
			}
		}
		// Files that turned out to be binary or unreadable stay recorded (so they are not re-read) with no chunks.
		for (const x of scan.files) if (f.files.get(x.rel)?.ids.length === 0) unreadable++;
		f.skipped = { ...scan.skipped, other: scan.skipped.other + unreadable };
		f.status = "ready";
		f.progress = undefined;
		f.lastIndexedAt = new Date().toISOString();
		this.saveIndex(f);
		this.saveFolders();
	}

	private addChunks(f: Folder, rel: string, list: Chunk[]): number[] {
		const ids: number[] = [];
		for (const c of list) {
			const id = this.nextId++;
			this.chunks.set(id, {
				folderId: f.id,
				rel,
				heading: c.heading,
				startLine: c.startLine,
				endLine: c.endLine,
				text: c.text,
			});
			this.index.add(id, indexText(rel, c.heading, c.text));
			ids.push(id);
		}
		return ids;
	}

	private dropChunks(ids: number[]): void {
		for (const id of ids) {
			this.chunks.delete(id);
			this.index.remove(id);
		}
	}

	// ── watching ──
	private watchFolder(f: Folder): void {
		if (f.watcher || f.removed) return;
		const debounce = this.deps.watchDebounceMs ?? 1500;
		try {
			f.watcher = watch(f.path, { recursive: true }, (_evt, filename) => {
				if (f.removed || this.stopped) return;
				if (filename && hasIgnoredSegment(filename.toString())) return;
				if (f.timer) clearTimeout(f.timer);
				f.timer = setTimeout(() => {
					f.timer = undefined;
					void this.run(f, false).catch(() => undefined);
				}, debounce);
			});
			f.watcher.on("error", () => {
				f.watcher?.close();
				f.watcher = undefined;
			});
		} catch (e) {
			log.warn("knowledge watch failed", (e as Error).message);
		}
	}

	// ── search / read ──
	async search(query: string, limit = 8): Promise<KnowledgeHit[]> {
		await this.ready;
		const n = Math.max(1, Math.min(20, Math.floor(limit) || 8));
		const raw = this.index.search(query, n * 6);
		const perFile = new Map<string, number>();
		const out: KnowledgeHit[] = [];
		for (const r of raw) {
			const c = this.chunks.get(r.id);
			const f = c && this.folders.get(c.folderId);
			if (!c || !f) continue;
			const abs = join(f.path, c.rel);
			const seen = perFile.get(abs) ?? 0;
			if (seen >= MAX_PER_FILE) continue;
			perFile.set(abs, seen + 1);
			out.push({
				path: abs,
				name: basename(c.rel),
				heading: c.heading,
				startLine: c.startLine,
				endLine: c.endLine,
				snippet: c.text.length > SNIPPET_CHARS ? `${c.text.slice(0, SNIPPET_CHARS)}…` : c.text,
				score: Math.round(r.score * 1000) / 1000,
			});
			if (out.length >= n) break;
		}
		return out;
	}

	/** Reads part of a file inside an indexed folder. Throws OpenDotError with a message fit for the model. */
	async read(target: string, startLine?: number, endLine?: number): Promise<KnowledgeReadResult> {
		await this.ready;
		const g = await resolveKnowledgeFile(target, this.roots());
		if (!g.ok) throw new OpenDotError("DENIED", g.reason);
		const name = basename(g.resolved);
		const st = await stat(g.resolved);
		const d = classifyFile(name, st.size);
		if (!d.index) {
			if (d.reason === "pdf") throw new OpenDotError("UNSUPPORTED", "PDFs aren't indexed yet.");
			if (d.reason === "too-large") throw new OpenDotError("TOO_LARGE", "That file is larger than 2 MB.");
			throw new OpenDotError("UNSUPPORTED", "That kind of file can't be read here.");
		}
		const buf = await readFile(g.resolved);
		if (looksBinary(buf)) throw new OpenDotError("UNSUPPORTED", "That file isn't text.");
		let text = buf.toString("utf8").replace(/^﻿/, "");
		if (d.kind === "html") text = htmlToText(text);
		const lines = text.replace(/\r\n?/g, "\n").split("\n");
		if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
		const total = lines.length;
		const start = Math.max(1, Math.floor(startLine ?? 1) || 1);
		if (start > total) throw new OpenDotError("INVALID", `That file has only ${total} lines.`);
		let end = Math.min(total, Math.floor(endLine ?? start + MAX_READ_LINES - 1) || start + MAX_READ_LINES - 1);
		end = Math.max(start, Math.min(end, start + MAX_READ_LINES - 1));
		let out = lines.slice(start - 1, end).join("\n");
		let truncated = end < total;
		if (out.length > MAX_READ_CHARS) {
			out = out.slice(0, MAX_READ_CHARS);
			end = start + out.split("\n").length - 1;
			truncated = true;
		}
		return { path: g.resolved, name, text: out, startLine: start, endLine: end, totalLines: total, truncated };
	}

	/** What the app should do with a source chip: open documents, reveal code and data (never run anything). */
	async openTarget(target: string): Promise<{ path: string; mode: "open" | "reveal" }> {
		await this.ready;
		const g = await resolveKnowledgeFile(target, this.roots());
		if (!g.ok) throw new OpenDotError("DENIED", g.reason);
		const d = classifyFile(basename(g.resolved), 1);
		const docKinds = ["markdown", "org", "rst", "text", "html"];
		return { path: g.resolved, mode: d.index && docKinds.includes(d.kind) ? "open" : "reveal" };
	}

	// ── persistence ──
	private indexFile(id: string): string {
		return join(this.deps.dir, `index-${id}.json`);
	}

	private enqueueWrite(fn: () => Promise<unknown>): void {
		this.writes = this.writes.then(fn, fn).catch((e) => log.warn("knowledge write failed", (e as Error).message));
	}

	private saveFolders(): void {
		const data: StoredFolders = {
			version: 1,
			folders: [...this.folders.values()].map((f) => ({
				id: f.id,
				path: f.path,
				addedAt: f.addedAt,
				lastIndexedAt: f.lastIndexedAt,
			})),
		};
		this.enqueueWrite(async () => {
			await mkdir(this.deps.dir, { recursive: true, mode: 0o700 });
			await writeFileAtomic(join(this.deps.dir, "folders.json"), `${JSON.stringify(data, null, 1)}\n`, { mode: 0o600 });
		});
	}

	private saveIndex(f: Folder): void {
		const files: StoredIndex["files"] = {};
		for (const [rel, rec] of f.files) {
			files[rel] = {
				size: rec.size,
				mtimeMs: rec.mtimeMs,
				chunks: rec.ids.map((id) => {
					const c = this.chunks.get(id)!;
					return { h: c.heading, s: c.startLine, e: c.endLine, t: c.text };
				}),
			};
		}
		const data: StoredIndex = { version: 1, skipped: f.skipped, files };
		const id = f.id;
		this.enqueueWrite(async () => {
			if (f.removed) return;
			await mkdir(this.deps.dir, { recursive: true, mode: 0o700 });
			await writeFileAtomic(this.indexFile(id), JSON.stringify(data), { mode: 0o600 });
		});
	}

	private async load(): Promise<void> {
		let stored: StoredFolders;
		try {
			stored = JSON.parse(await readFile(join(this.deps.dir, "folders.json"), "utf8")) as StoredFolders;
		} catch {
			return;
		}
		if (stored?.version !== 1 || !Array.isArray(stored.folders)) return;
		for (const s of stored.folders) {
			if (typeof s.id !== "string" || typeof s.path !== "string") continue;
			const f: Folder = {
				id: s.id,
				path: s.path,
				name: basename(s.path) || s.path,
				addedAt: s.addedAt,
				lastIndexedAt: s.lastIndexedAt,
				status: "queued",
				files: new Map(),
				skipped: { pdf: 0, tooLarge: 0, other: 0 },
				again: false,
				againFull: false,
				removed: false,
			};
			try {
				const idx = JSON.parse(await readFile(this.indexFile(f.id), "utf8")) as StoredIndex;
				if (idx?.version === 1) {
					if (idx.skipped) f.skipped = idx.skipped;
					let n = 0;
					for (const [rel, rec] of Object.entries(idx.files ?? {})) {
						f.files.set(rel, {
							size: rec.size,
							mtimeMs: rec.mtimeMs,
							ids: this.addChunks(
								f,
								rel,
								rec.chunks.map((c) => ({ heading: c.h, startLine: c.s, endLine: c.e, text: c.t })),
							),
						});
						if (++n % 100 === 0) await yieldNow();
					}
					f.status = "ready";
				}
			} catch {
				// No saved index: it is rebuilt by the first scan.
			}
			this.folders.set(f.id, f);
		}
		this.emit(true);
	}
}
