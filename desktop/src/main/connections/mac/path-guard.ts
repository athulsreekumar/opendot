// Path confinement for the files capability (spec 05 §6.1).
import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export function expandTilde(p: string, home: string = homedir()): string {
	if (p === "~") return home;
	if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(home, p.slice(2));
	return p;
}

/** realpath of the nearest existing ancestor, with the missing remainder rejoined. */
async function realpathLoose(abs: string): Promise<string> {
	const missing: string[] = [];
	let cur = abs;
	for (;;) {
		try {
			const real = await realpath(cur);
			return path.join(real, ...missing.reverse());
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== "ENOENT" && code !== "ENOTDIR") throw err;
			const parent = path.dirname(cur);
			if (parent === cur) return abs;
			missing.push(path.basename(cur));
			cur = parent;
		}
	}
}

/** Whether `target` is `root` or below it. `p` is injectable so Windows rules (drive letters, case, backslashes) can be tested anywhere. */
export function isInside(
	root: string,
	target: string,
	p: Pick<typeof path, "relative" | "isAbsolute" | "sep"> = path,
): boolean {
	const rel = p.relative(root, target);
	// Different drives (or UNC shares) make path.relative return an absolute path.
	return rel === "" || (rel !== ".." && !rel.startsWith(`..${p.sep}`) && !p.isAbsolute(rel));
}

export async function checkPath(
	target: string,
	allowedRoots: string[],
): Promise<{ ok: true; resolved: string } | { ok: false; reason: string; resolved?: string }> {
	const reason = `This Dot can only access: ${allowedRoots.join(", ")}`;
	let resolved: string | undefined;
	try {
		const base = allowedRoots[0] ? expandTilde(allowedRoots[0]) : process.cwd();
		const abs = path.resolve(base, expandTilde(target));
		resolved = await realpathLoose(abs);
		for (const r of allowedRoots) {
			const root = await realpathLoose(path.resolve(expandTilde(r)));
			if (isInside(root, resolved)) return { ok: true, resolved };
		}
		return { ok: false, reason, resolved };
	} catch {
		return { ok: false, reason, ...(resolved ? { resolved } : {}) };
	}
}

async function isDir(p: string): Promise<boolean> {
	return stat(p).then(
		(s) => s.isDirectory(),
		() => false,
	);
}

/**
 * What to offer when a Dot reaches outside its folders: the project it is in (the nearest folder with a `.git`), so
 * one answer covers the whole project, else the folder itself (or the file's folder). Never the home folder or
 * anything above it: there, only the path itself is offered.
 */
export async function folderToGrant(resolved: string, home: string = homedir()): Promise<string> {
	const dir = (await isDir(resolved)) ? resolved : path.dirname(resolved);
	const homeReal = await realpathLoose(home);
	if (isInside(dir, homeReal)) return resolved;
	// Never offer the home folder or anything above it, even if it has a .git.
	for (let cur = dir; !isInside(cur, homeReal); cur = path.dirname(cur)) {
		if (await stat(path.join(cur, ".git")).catch(() => undefined)) return cur;
		if (path.dirname(cur) === cur) break;
	}
	return dir;
}

const PATH_TOOLS = new Set(["read", "write", "edit"]);
const DEFAULT_DOT_TOOLS = new Set(["ls", "grep", "find"]);

/** The path argument of a pi built-in file tool, or undefined for other tools. */
export function fileToolPath(toolName: string, input: unknown): string | undefined {
	const p = input && typeof input === "object" ? (input as { path?: unknown }).path : undefined;
	if (PATH_TOOLS.has(toolName)) return typeof p === "string" ? p : undefined;
	if (DEFAULT_DOT_TOOLS.has(toolName)) return typeof p === "string" && p !== "" ? p : ".";
	return undefined;
}
