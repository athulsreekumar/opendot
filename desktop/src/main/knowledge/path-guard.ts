// knowledge_read and "open source" may only touch files inside an indexed folder. Built on the Files path guard
// (realpath, so symlinks cannot lead out), plus Knowledge's own rules: no hidden or generated folders.
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { checkPath } from "../connections/mac/path-guard";
import { hasIgnoredSegment } from "./filter";

export type KnowledgePath = { ok: true; resolved: string; root: string; rel: string } | { ok: false; reason: string };

const DENIED = "That file isn't inside a folder indexed by Knowledge.";

/** Syntax checks that need no file system: empty, NUL bytes, absurd length. */
export function badPathSyntax(target: unknown): string | undefined {
	if (typeof target !== "string" || !target.trim()) return "Give a file path.";
	if (target.length > 4096) return "That path is too long.";
	if (target.includes("\0")) return "That path isn't valid.";
	return undefined;
}

/** The root-relative path of `resolved`, or undefined when it is outside `root`. `p` is injectable for Windows tests. */
export function relativeInside(
	root: string,
	resolved: string,
	p: Pick<typeof path, "relative" | "isAbsolute" | "sep"> = path,
): string | undefined {
	const rel = p.relative(root, resolved);
	if (rel === "") return "";
	if (rel === ".." || rel.startsWith(`..${p.sep}`) || p.isAbsolute(rel)) return undefined;
	return rel;
}

async function candidates(
	target: string,
	roots: string[],
): Promise<{ list: Array<Extract<KnowledgePath, { ok: true }>>; reason: string }> {
	const bad = badPathSyntax(target);
	if (bad) return { list: [], reason: bad };
	let reason = DENIED;
	const list: Array<Extract<KnowledgePath, { ok: true }>> = [];
	for (const root of roots) {
		const res = await checkPath(target, [root]);
		if (!res.ok) continue;
		let realRoot: string;
		try {
			realRoot = await realpath(root);
		} catch {
			continue;
		}
		const rel = relativeInside(realRoot, res.resolved);
		if (rel === undefined) continue;
		if (rel === "" || hasIgnoredSegment(rel)) {
			reason = DENIED;
			continue;
		}
		list.push({ ok: true, resolved: res.resolved, root, rel });
	}
	return { list, reason };
}

/** The first indexed folder that contains `target` (relative paths are tried against every folder). */
export async function resolveKnowledgePath(target: string, roots: string[]): Promise<KnowledgePath> {
	const c = await candidates(target, roots);
	return c.list[0] ?? { ok: false, reason: c.reason };
}

/** Like resolveKnowledgePath but also requires an existing regular file. */
export async function resolveKnowledgeFile(target: string, roots: string[]): Promise<KnowledgePath> {
	const c = await candidates(target, roots);
	if (!c.list.length) return { ok: false, reason: c.reason };
	for (const r of c.list) {
		try {
			if ((await stat(r.resolved)).isFile()) return r;
		} catch {
			// try the next folder
		}
	}
	return { ok: false, reason: "That file doesn't exist." };
}
