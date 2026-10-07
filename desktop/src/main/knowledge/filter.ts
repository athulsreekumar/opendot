// Which files Knowledge indexes: text-like types only, no hidden or generated folders, nothing huge or binary.
import path from "node:path";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type FileKind = "markdown" | "org" | "rst" | "text" | "html" | "data" | "code";

const KINDS: Record<string, FileKind> = {
	".md": "markdown",
	".markdown": "markdown",
	".mdx": "markdown",
	".org": "org",
	".rst": "rst",
	".txt": "text",
	".text": "text",
	".log": "text",
	".csv": "data",
	".tsv": "data",
	".json": "data",
	".jsonl": "data",
	".html": "html",
	".htm": "html",
};

const CODE_EXTS = [
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".py",
	".rb",
	".go",
	".rs",
	".java",
	".kt",
	".swift",
	".c",
	".h",
	".cc",
	".cpp",
	".hpp",
	".cs",
	".php",
	".sh",
	".bash",
	".zsh",
	".ps1",
	".sql",
	".css",
	".scss",
	".yaml",
	".yml",
	".toml",
	".ini",
	".xml",
	".tex",
	".lua",
	".r",
	".scala",
];
for (const e of CODE_EXTS) KINDS[e] = "code";

/** Lockfiles are huge and say nothing useful. */
const SKIP_FILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock", "cargo.lock"]);

const SKIP_DIRS = new Set(["node_modules", "__pycache__", "$recycle.bin", "system volume information"]);

export type FileDecision =
	| { index: true; kind: FileKind }
	| { index: false; reason: "pdf" | "too-large" | "unsupported" | "hidden" | "empty" };

export function classifyFile(name: string, size: number): FileDecision {
	if (name.startsWith(".") || name.startsWith("~$")) return { index: false, reason: "hidden" };
	const lower = name.toLowerCase();
	const ext = path.extname(lower);
	if (ext === ".pdf") return { index: false, reason: "pdf" };
	if (SKIP_FILES.has(lower)) return { index: false, reason: "unsupported" };
	const kind = KINDS[ext];
	if (!kind) return { index: false, reason: "unsupported" };
	if (size > MAX_FILE_BYTES) return { index: false, reason: "too-large" };
	if (size === 0) return { index: false, reason: "empty" };
	return { index: true, kind };
}

export function isIgnoredDir(name: string): boolean {
	return name.startsWith(".") || SKIP_DIRS.has(name.toLowerCase());
}

/** True when any segment of a root-relative path is a hidden or generated folder, or a hidden file. */
export function hasIgnoredSegment(rel: string): boolean {
	return rel
		.split(/[\\/]+/)
		.filter((s) => s && s !== ".")
		.some((s) => s.startsWith(".") || SKIP_DIRS.has(s.toLowerCase()));
}

/** NUL bytes in the first 8 KB mean the file is binary, whatever its extension says. */
export function looksBinary(buf: Uint8Array): boolean {
	const n = Math.min(buf.length, 8192);
	for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
	return false;
}
