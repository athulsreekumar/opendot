// Walks an indexed folder. Yields to the event loop regularly so a big tree never freezes the app.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { classifyFile, type FileKind, isIgnoredDir } from "./filter";

export interface ScannedFile {
	rel: string;
	abs: string;
	size: number;
	mtimeMs: number;
	kind: FileKind;
}

export interface ScanResult {
	files: ScannedFile[];
	skipped: { pdf: number; tooLarge: number; other: number };
}

export const yieldNow = (): Promise<void> => new Promise((r) => setImmediate(r));

/**
 * Lists indexable files under `root`. Hidden folders, node_modules and symlinks are skipped (a link could point
 * outside the folder the user chose). Throws if the root itself cannot be read.
 */
export async function scanFolder(root: string, shouldStop: () => boolean = () => false): Promise<ScanResult> {
	const files: ScannedFile[] = [];
	const skipped = { pdf: 0, tooLarge: 0, other: 0 };
	let sinceYield = 0;
	const walk = async (dir: string, rel: string, top: boolean): Promise<void> => {
		let entries: import("node:fs").Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (e) {
			if (top) throw e;
			return;
		}
		for (const e of entries) {
			if (shouldStop()) return;
			if (++sinceYield >= 200) {
				sinceYield = 0;
				await yieldNow();
			}
			if (e.isSymbolicLink()) continue;
			const childRel = rel ? join(rel, e.name) : e.name;
			if (e.isDirectory()) {
				if (!isIgnoredDir(e.name)) await walk(join(dir, e.name), childRel, false);
				continue;
			}
			if (!e.isFile()) continue;
			const abs = join(dir, e.name);
			let st: import("node:fs").Stats;
			try {
				st = await stat(abs);
			} catch {
				continue;
			}
			const d = classifyFile(e.name, st.size);
			if (!d.index) {
				if (d.reason === "pdf") skipped.pdf++;
				else if (d.reason === "too-large") skipped.tooLarge++;
				else if (d.reason === "unsupported") skipped.other++;
				continue;
			}
			files.push({ rel: childRel, abs, size: st.size, mtimeMs: st.mtimeMs, kind: d.kind });
		}
	};
	await walk(root, "", true);
	return { files, skipped };
}
