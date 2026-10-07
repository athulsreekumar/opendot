// Deliverable files of a task: collecting what a Dot wrote, and resolving one safely (docs/spec/15-organisation.md §6).
// Files live in the assignee's own workspace; nothing outside it is ever read or opened.
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import type { OrgDeliverable } from "../../shared/organisation";

export const MAX_DELIVERABLES = 50;
/** Text deliverables up to this size are shown to a reviewer. */
export const REVIEW_TEXT_EXT = new Set([".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".html", ".xml", ".log"]);

/** The folder a task's files go in, relative to the workspace (always with "/"). */
export const taskFolder = (projectId: string, taskId: string): string => `projects/${projectId}/${taskId}`;

const baseName = (p: string): string => p.split("/").pop() ?? p;

export type Snapshot = Map<string, string>;

async function walk(root: string, rel: string, out: Snapshot): Promise<void> {
	if (out.size >= MAX_DELIVERABLES * 4) return;
	let entries: import("node:fs").Dirent[];
	try {
		entries = await readdir(join(root, ...rel.split("/")), { withFileTypes: true });
	} catch {
		return;
	}
	entries.sort((a, b) => a.name.localeCompare(b.name));
	for (const e of entries) {
		if (e.name.startsWith(".")) continue; // hidden files
		const childRel = `${rel}/${e.name}`;
		if (e.isDirectory()) await walk(root, childRel, out);
		else if (e.isFile()) {
			// Symbolic links are skipped on purpose: they could point outside the workspace.
			try {
				const st = await lstat(join(root, ...childRel.split("/")));
				if (st.isFile()) out.set(childRel, `${st.mtimeMs}:${st.size}`);
			} catch {
				// vanished
			}
		}
	}
}

/** Files (with a change signature) under the task folder, as paths relative to the workspace. */
export async function snapshotTaskFiles(workspaceDir: string, projectId: string, taskId: string): Promise<Snapshot> {
	const out: Snapshot = new Map();
	await walk(workspaceDir, taskFolder(projectId, taskId), out);
	return out;
}

/** Files that are new or changed since `before`, merged into `existing` (same path keeps its place). */
export async function collectDeliverables(
	workspaceDir: string,
	projectId: string,
	taskId: string,
	before: Snapshot | undefined,
	existing: OrgDeliverable[],
): Promise<OrgDeliverable[]> {
	const after = await snapshotTaskFiles(workspaceDir, projectId, taskId);
	const out = [...existing];
	for (const [path, sig] of after) {
		if (before && before.get(path) === sig) continue;
		const d: OrgDeliverable = { kind: "file", title: baseName(path), path };
		const i = out.findIndex((x) => x.kind === "file" && x.path === path);
		if (i >= 0) out[i] = d;
		else out.push(d);
	}
	return out.slice(0, MAX_DELIVERABLES);
}

function isInside(root: string, target: string): boolean {
	const rel = relative(root, target);
	return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** A relative path that is safe to join onto a workspace: no absolute, drive, UNC or `..` forms, on any OS. */
export function isSafeRelativePath(rel: string): boolean {
	if (typeof rel !== "string" || !rel || rel.length > 1024 || rel.includes("\0")) return false;
	if (rel.startsWith("/") || rel.startsWith("\\") || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return false;
	return !rel.split(/[\\/]+/).some((seg) => seg === "..");
}

/**
 * Absolute path of a workspace file, or undefined when `rel` is not a plain relative path inside the workspace or the
 * file doesn't exist. Symbolic links are resolved first, so a link that leaves the workspace is refused.
 */
export async function resolveWorkspaceFile(workspaceDir: string, rel: string): Promise<string | undefined> {
	if (!isSafeRelativePath(rel)) return undefined;
	const lexical = join(workspaceDir, ...rel.split(/[\\/]+/).filter(Boolean));
	if (!isInside(workspaceDir, lexical)) return undefined;
	try {
		const [realRoot, realFile] = await Promise.all([realpath(workspaceDir), realpath(lexical)]);
		if (!isInside(realRoot, realFile)) return undefined;
		if (!(await stat(realFile)).isFile()) return undefined;
		return realFile;
	} catch {
		return undefined;
	}
}

/** Text of small text deliverables, for a reviewer (names are always listed; content only up to `maxChars` in total). */
export async function readTextDeliverables(
	workspaceDir: string,
	files: OrgDeliverable[],
	maxChars = 6000,
): Promise<Array<{ title: string; text: string }>> {
	const out: Array<{ title: string; text: string }> = [];
	let left = maxChars;
	for (const d of files) {
		if (left <= 0) break;
		if (d.kind !== "file" || !d.path) continue;
		const ext = d.path.slice(d.path.lastIndexOf(".")).toLowerCase();
		if (!REVIEW_TEXT_EXT.has(ext)) continue;
		const file = await resolveWorkspaceFile(workspaceDir, d.path);
		if (!file) continue;
		try {
			if ((await stat(file)).size > maxChars * 4) continue;
			const text = (await readFile(file, "utf8")).slice(0, left);
			out.push({ title: d.title, text });
			left -= text.length;
		} catch {
			// unreadable: skip
		}
	}
	return out;
}
