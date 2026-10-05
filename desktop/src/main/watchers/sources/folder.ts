// folder source (spec 12 §4): push via fs.watch with per-path debounce.
import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

export const folderConfigSchema = z.object({
	path: z.string().min(1),
	recursive: z.boolean(),
	include: z.array(z.string()).optional(),
	events: z.array(z.enum(["created", "modified", "deleted"])),
});
export type FolderConfig = z.infer<typeof folderConfigSchema>;

const DEBOUNCE_MS = 2000;

export function expandTilde(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
	return p;
}

function isIgnored(rel: string): boolean {
	const parts = rel.split(/[\\/]/).filter(Boolean);
	if (parts.some((s) => s.startsWith("."))) return true;
	const name = parts[parts.length - 1] ?? "";
	return name.startsWith("~$") || /\.(crdownload|part|tmp)$/i.test(name) || name === ".DS_Store";
}

function matchesInclude(name: string, include?: string[]): boolean {
	if (!include || include.length === 0) return true;
	const lower = name.toLowerCase();
	return include.some((g) => {
		const pat = g.toLowerCase();
		if (pat.startsWith("*.")) return lower.endsWith(pat.slice(1));
		if (pat === "*") return true;
		return lower === pat;
	});
}

async function scan(dir: string, recursive: boolean, out: Map<string, number>): Promise<void> {
	let entries: import("node:fs").Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const e of entries) {
		if (e.name.startsWith(".")) continue;
		const full = join(dir, e.name);
		if (e.isDirectory()) {
			if (recursive) await scan(full, true, out);
		} else if (e.isFile()) {
			try {
				out.set(full, (await stat(full)).size);
			} catch {
				// vanished
			}
		}
	}
}

export const folderSource: WatcherSource<FolderConfig> = {
	type: "folder",
	label: "Folder",
	configSchema: folderConfigSchema,
	defaultIntervalSec: 0,
	minIntervalSec: 0,
	async start(ctx: SourceCtx<FolderConfig>) {
		const root = resolve(expandTilde(ctx.config.path));
		const folderName = basename(root) || root;
		const known = new Map<string, number>();
		await scan(root, ctx.config.recursive, known);
		const timers = new Map<string, NodeJS.Timeout>();
		let stopped = false;

		const classify = async (full: string): Promise<void> => {
			if (stopped) return;
			let size: number | undefined;
			try {
				const st = await stat(full);
				if (st.isDirectory()) return;
				size = st.size;
			} catch {
				size = undefined;
			}
			const name = basename(full);
			let kind: "created" | "modified" | "deleted";
			if (size === undefined) {
				if (!known.has(full)) return;
				known.delete(full);
				kind = "deleted";
			} else {
				kind = known.has(full) ? "modified" : "created";
				known.set(full, size);
			}
			if (!ctx.config.events.includes(kind)) return;
			if (!matchesInclude(name, ctx.config.include)) return;
			const word = kind === "created" ? "New file" : kind === "modified" ? "Changed" : "Deleted";
			const at = ctx.deps.now().toISOString();
			const ev: NewEvent = {
				title: `${word} ${name} in ${folderName}`,
				body: `${word} ${full}`,
				facts: { path: full, size: String(size ?? 0), change: kind },
				dedupeKey: `${kind}:${full}:${size ?? 0}:${at}`,
				importanceHint: "normal",
				occurredAt: at,
			};
			ctx.emit(ev);
		};

		let watcher: FSWatcher;
		try {
			watcher = watch(root, { recursive: ctx.config.recursive }, (_evt, filename) => {
				if (!filename || stopped) return;
				const rel = filename.toString();
				if (isIgnored(rel)) return;
				const full = join(root, rel);
				const prev = timers.get(full);
				if (prev) clearTimeout(prev);
				timers.set(
					full,
					setTimeout(() => {
						timers.delete(full);
						classify(full).catch((e) => ctx.deps.log.warn("folder watcher classify failed", e));
					}, DEBOUNCE_MS),
				);
			});
		} catch (e) {
			throw new Error(`Cannot watch ${root}: ${e instanceof Error ? e.message : String(e)}`);
		}
		watcher.on("error", (e) => ctx.deps.log.warn("folder watcher error", e));

		return async () => {
			stopped = true;
			watcher.close();
			for (const t of timers.values()) clearTimeout(t);
			timers.clear();
		};
	},
	async test(ctx) {
		const root = resolve(expandTilde(ctx.config.path));
		try {
			const st = await stat(root);
			if (!st.isDirectory()) return { ok: false, message: `${root} is not a folder`, sample: [] };
		} catch {
			return { ok: false, message: `Folder not found: ${root}`, sample: [] };
		}
		const files = new Map<string, number>();
		await scan(root, ctx.config.recursive, files);
		const withTime: Array<{ path: string; size: number; mtime: number }> = [];
		for (const [path, size] of files) {
			if (isIgnored(path.slice(root.length)) || !matchesInclude(basename(path), ctx.config.include)) continue;
			try {
				withTime.push({ path, size, mtime: (await stat(path)).mtimeMs });
			} catch {
				// skip
			}
		}
		withTime.sort((a, b) => b.mtime - a.mtime);
		const folderName = basename(root) || root;
		const sample: NewEvent[] = withTime.slice(0, 3).map((f) => ({
			title: `New file ${basename(f.path)} in ${folderName}`,
			body: f.path,
			facts: { path: f.path, size: String(f.size) },
			dedupeKey: `sample:${f.path}`,
			importanceHint: "normal",
			occurredAt: new Date(f.mtime).toISOString(),
		}));
		return { ok: true, message: `Watching ${root} (${files.size} existing files)`, sample };
	},
};
