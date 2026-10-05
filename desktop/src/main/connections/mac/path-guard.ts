// Path confinement for the files capability (spec 05 §6.1).
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

function expandTilde(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return path.join(homedir(), p.slice(2));
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

function inside(root: string, target: string): boolean {
	const rel = path.relative(root, target);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function checkPath(
	target: string,
	allowedRoots: string[],
): Promise<{ ok: true; resolved: string } | { ok: false; reason: string }> {
	const reason = `This Dot can only access: ${allowedRoots.join(", ")}`;
	try {
		const base = allowedRoots[0] ? expandTilde(allowedRoots[0]) : process.cwd();
		const abs = path.resolve(base, expandTilde(target));
		const resolved = await realpathLoose(abs);
		for (const r of allowedRoots) {
			const root = await realpathLoose(path.resolve(expandTilde(r)));
			if (inside(root, resolved)) return { ok: true, resolved };
		}
		return { ok: false, reason };
	} catch {
		return { ok: false, reason };
	}
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
