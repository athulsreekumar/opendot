// Chat attachments: type detection, limits, inlining and the on-the-wire block format.
// Pure functions only, so the main process and the renderer share one definition.
import type { AttachmentKind, AttachmentView } from "./types";

export const MAX_ATTACHMENTS = 10;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Text longer than this is cut when inlined into the prompt (the full file is still copied to the workspace). */
export const INLINE_MAX_CHARS = 60_000;
export const ATTACHMENTS_DIR = "attachments";

const IMAGE_MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
};

const TEXT_EXT = new Set(
	(
		"txt md markdown mdx rst csv tsv json jsonl ndjson yaml yml toml ini cfg conf env properties log xml html htm css scss less " +
		"js mjs cjs jsx ts tsx py rb go rs java kt swift c h cpp hpp cc cs php sh bash zsh fish ps1 bat cmd sql r lua pl " +
		"tex srt vtt diff patch gradle svg graphql proto vue svelte"
	).split(" "),
);
const TEXT_NAMES = new Set(["dockerfile", "makefile", "readme", "license", "gitignore", "gemfile"]);

/** Files we are willing to open with the OS default app. Anything else is only revealed in the file manager. */
const OPEN_SAFE_EXT = new Set([
	...Object.keys(IMAGE_MIME),
	...TEXT_EXT,
	..."pdf doc docx xls xlsx ppt pptx odt ods odp rtf pages numbers key zip".split(" "),
]);
// Even text-like extensions that an OS would execute are never opened.
const OPEN_BLOCKED_EXT = new Set("ps1 bat cmd sh bash zsh fish py rb pl js mjs cjs".split(" "));

export function extOf(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? name;
	const i = base.lastIndexOf(".");
	return i <= 0 ? "" : base.slice(i + 1).toLowerCase();
}

export function imageMimeOf(name: string): string | undefined {
	return IMAGE_MIME[extOf(name)];
}

/** Decide how a file is handled. `mime` is the browser-reported type (may be empty). */
export function detectKind(name: string, mime = ""): AttachmentKind {
	const ext = extOf(name);
	if (IMAGE_MIME[ext]) return "image";
	if (TEXT_EXT.has(ext)) return "text";
	const base = (name.split(/[\\/]/).pop() ?? name).toLowerCase();
	if (!ext && TEXT_NAMES.has(base)) return "text";
	if (/^image\/(png|jpeg|gif|webp)$/i.test(mime)) return "image";
	if (/^text\//i.test(mime) || /^application\/(json|xml|x-yaml|yaml|x-ndjson|toml)$/i.test(mime)) return "text";
	return "file";
}

/** An image whose bytes don't look like what its extension says is handled as a plain file. */
export function sniffImageMime(bytes: Uint8Array): string | undefined {
	const b = bytes;
	if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
	if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
	if (
		b.length >= 12 &&
		b[0] === 0x52 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x46 &&
		b[8] === 0x57 &&
		b[9] === 0x45 &&
		b[10] === 0x42 &&
		b[11] === 0x50
	)
		return "image/webp";
	return undefined;
}

/** True when the bytes contain NUL (binary) in the first 8 KB. */
export function looksBinary(bytes: Uint8Array): boolean {
	const n = Math.min(bytes.length, 8192);
	for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
	return false;
}

export function limitFor(kind: AttachmentKind): number {
	return kind === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const TOO_MANY_MESSAGE = `You can attach up to ${MAX_ATTACHMENTS} files to one message.`;
export const FOLDER_MESSAGE = "Folders can't be attached. Add the files inside it instead.";
export const IMAGE_ATTACH_TOOLTIP = "Images are sent to the model as-is";

/** Friendly error when a file is over its limit, otherwise undefined. */
export function sizeError(name: string, kind: AttachmentKind, size: number): string | undefined {
	if (size <= limitFor(kind)) return undefined;
	const mb = limitFor(kind) / (1024 * 1024);
	return kind === "image"
		? `${name} is over ${mb} MB. Choose a smaller image.`
		: `${name} is over ${mb} MB. Choose a smaller file.`;
}

// ───────────────────────── Workspace copy names ─────────────────────────
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** A file name that is valid on Windows, macOS and Linux. Never contains a path separator. */
export function safeFileName(name: string, maxLen = 100): string {
	const base = name.split(/[\\/]/).pop() ?? "";
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
	let n = base.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").normalize("NFC");
	n = n.replace(/^[\s.]+/, "").replace(/[\s.]+$/, "");
	if (!n) n = "file";
	if (RESERVED.test(n)) n = `_${n}`;
	if (n.length > maxLen) {
		const ext = extOf(n);
		const keep = ext && ext.length < 12 ? `.${ext}` : "";
		n = `${n.slice(0, maxLen - keep.length)}${keep}`;
	}
	return n;
}

/**
 * Compact UTC timestamp like 20261007T143012. The letter matters: a bare run of 13+ digits (epoch milliseconds) can
 * pass the card-number check and get masked as personal data in the prompt.
 */
export function fileStamp(timestampMs: number): string {
	return new Date(timestampMs)
		.toISOString()
		.replace(/\.\d+Z$/, "")
		.replace(/[-:]/g, "");
}

/** `<timestamp>-<name>`, safe on every OS. `attempt` > 0 disambiguates collisions. */
export function workspaceCopyName(timestampMs: number, name: string, attempt = 0): string {
	const safe = safeFileName(name);
	const stamp = fileStamp(timestampMs);
	return `${attempt > 0 ? `${stamp}-${attempt + 1}` : stamp}-${safe}`;
}

export function isOpenSafe(name: string): boolean {
	const ext = extOf(name);
	return OPEN_SAFE_EXT.has(ext) && !OPEN_BLOCKED_EXT.has(ext);
}

// ───────────────────────── Inlining ─────────────────────────
export function truncateForInline(text: string, max = INLINE_MAX_CHARS): { text: string; truncated: boolean } {
	if (text.length <= max) return { text, truncated: false };
	return { text: text.slice(0, max), truncated: true };
}

export interface BlockMeta {
	name: string;
	kind: AttachmentKind;
	mime?: string;
	size?: number;
	/** Workspace-relative path, e.g. attachments/1700000000000-notes.txt */
	path?: string;
	truncated?: boolean;
	/** Image sent as a file reference only (the model did not receive the pixels). */
	asReference?: boolean;
}

const OPEN = "[[opendot:attachment ";
const CLOSE = "[[/opendot:attachment]]";
const BLOCK_RE = /\[\[opendot:attachment (\{.*?\})\]\]\n?([\s\S]*?)\n?\[\[\/opendot:attachment\]\]/g;

/** One delimited block. `body` is the file text (text files) or a short note for the model. */
export function formatAttachmentBlock(meta: BlockMeta, body = ""): string {
	// "]]" inside the JSON would end the header early; ] is the same character in JSON.
	const head = JSON.stringify(meta).replace(/\]\]/g, "]\\u005d");
	return `${OPEN}${head}]]\n${body.split(CLOSE).join("[[ /opendot:attachment]]")}\n${CLOSE}`;
}

/** The text of a user message: what they typed, then one block per attachment. */
export function composeUserText(typed: string, blocks: string[]): string {
	const t = typed.trim();
	return [t, ...blocks].filter(Boolean).join("\n\n");
}

export function mediaUrl(dotId: string, relPath: string): string {
	const file = relPath.split(/[\\/]/).pop() ?? "";
	return `opendot-media://x/dot/${encodeURIComponent(dotId)}/${encodeURIComponent(file)}`;
}

/** Split attachment blocks out of a user message so the chat shows the typed text plus chips/thumbnails. */
export function parseAttachmentBlocks(text: string, dotId?: string): { text: string; attachments: AttachmentView[] } {
	if (!text.includes(OPEN)) return { text, attachments: [] };
	const attachments: AttachmentView[] = [];
	const stripped = text.replace(BLOCK_RE, (_m, head: string) => {
		try {
			const meta = JSON.parse(head) as BlockMeta;
			if (typeof meta.name !== "string") return "";
			const kind: AttachmentKind = meta.kind === "image" || meta.kind === "text" ? meta.kind : "file";
			attachments.push({
				name: meta.name,
				kind,
				mime: meta.mime,
				size: meta.size,
				path: meta.path,
				truncated: meta.truncated,
				asReference: meta.asReference,
				url: kind === "image" && meta.path && dotId ? mediaUrl(dotId, meta.path) : undefined,
			});
		} catch {
			// A malformed header is dropped from the view rather than shown as noise.
		}
		return "";
	});
	return { text: stripped.replace(/\n{3,}/g, "\n\n").trim(), attachments };
}
