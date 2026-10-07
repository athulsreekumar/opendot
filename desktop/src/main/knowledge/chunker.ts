// Splits a document into searchable chunks (~800 chars) that remember their heading and line range.
import type { FileKind } from "./filter";

export interface Chunk {
	text: string;
	heading: string;
	/** 1-based, inclusive. */
	startLine: number;
	endLine: number;
}

export const TARGET_CHARS = 800;
export const OVERLAP_CHARS = 120;
const SOFT_BREAK_CHARS = 480;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Plain text of an HTML page. Headings become markdown headings so they chunk like a note would. */
export function htmlToText(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1\s*>/gi, "")
		.replace(
			/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi,
			(_m, n: string, inner: string) => `\n\n${"#".repeat(Number(n))} ${inner.replace(/<[^>]*>/g, "")}\n\n`,
		)
		.replace(/<\/?(p|div|section|article|main|header|footer|nav|ul|ol|table|tr|blockquote|pre|br|hr)\b[^>]*>/gi, "\n")
		.replace(/<li\b[^>]*>/gi, "\n- ")
		.replace(/<\/(td|th)\s*>/gi, " | ")
		.replace(/<[^>]*>/g, "")
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
			if (e[0] === "#") {
				const code = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
				return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
			}
			return ENTITIES[e.toLowerCase()] ?? m;
		})
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

interface Line {
	text: string;
	no: number;
}

function headingOf(kind: FileKind, line: string, next: string | undefined): string | undefined {
	if (kind === "markdown" || kind === "html") {
		const m = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
		if (m) return m[1]!.trim();
		// Setext headings
		if (next !== undefined && line.trim() && /^ {0,3}(=+|-{2,})\s*$/.test(next) && !/^\s*[-*+]\s/.test(line))
			return line.trim();
	}
	if (kind === "org") {
		const m = /^\*+\s+(.+)$/.exec(line);
		if (m) return m[1]!.trim();
	}
	if (kind === "rst") {
		if (
			next !== undefined &&
			line.trim() &&
			/^([=\-~^"'`#*+])\1{2,}\s*$/.test(next) &&
			next.trim().length >= Math.min(line.trim().length, 3)
		)
			return line.trim();
	}
	return undefined;
}

/** Split a long single line at spaces so no chunk grows far beyond the target (with a small overlap). */
function splitLongLine(line: Line): Line[] {
	const t = line.text;
	if (t.length <= TARGET_CHARS * 1.5) return [line];
	const out: Line[] = [];
	let start = 0;
	while (t.length - start > TARGET_CHARS * 1.5) {
		let cut = t.lastIndexOf(" ", start + TARGET_CHARS);
		if (cut < start + TARGET_CHARS / 2) cut = start + TARGET_CHARS;
		out.push({ text: t.slice(start, cut), no: line.no });
		let next = cut - OVERLAP_CHARS / 2;
		const space = t.indexOf(" ", next);
		if (space >= 0 && space < cut) next = space + 1;
		start = Math.max(start + 1, next);
	}
	out.push({ text: t.slice(start), no: line.no });
	return out;
}

function sectionChunks(heading: string, lines: Line[], out: Chunk[]): void {
	let cur: Line[] = [];
	let len = 0;
	const flush = (carry: boolean) => {
		const text = cur
			.map((l) => l.text)
			.join("\n")
			.trim();
		if (text) {
			const first = cur.find((l) => l.text.trim()) ?? cur[0]!;
			const last = [...cur].reverse().find((l) => l.text.trim()) ?? cur[cur.length - 1]!;
			out.push({ text, heading, startLine: first.no, endLine: last.no });
		}
		if (carry) {
			// Overlap: keep the last few lines (up to OVERLAP_CHARS) so a sentence cut at the boundary appears in both chunks.
			const keep: Line[] = [];
			let n = 0;
			for (let i = cur.length - 1; i > 0; i--) {
				const l = cur[i]!;
				if (n + l.text.length > OVERLAP_CHARS) break;
				keep.unshift(l);
				n += l.text.length + 1;
			}
			cur = keep;
			len = n;
		} else {
			cur = [];
			len = 0;
		}
	};
	for (const raw of lines) {
		for (const l of splitLongLine(raw)) {
			const blank = !l.text.trim();
			if (blank && len >= SOFT_BREAK_CHARS) {
				flush(false);
				continue;
			}
			if (!blank && len + l.text.length + 1 > TARGET_CHARS && cur.some((x) => x.text.trim())) flush(true);
			if (blank && cur.length === 0) continue;
			cur.push(l);
			len += l.text.length + 1;
		}
	}
	if (cur.some((l) => l.text.trim())) flush(false);
}

/** Chunk a document. Headings (markdown, org, rst, html) start new chunks; other text splits on paragraphs. */
export function chunkText(text: string, kind: FileKind): Chunk[] {
	const src = kind === "html" ? htmlToText(text) : text;
	const raw = src.replace(/\r\n?/g, "\n").split("\n");
	const sections: Array<{ heading: string; lines: Line[] }> = [{ heading: "", lines: [] }];
	let fence = false;
	for (let i = 0; i < raw.length; i++) {
		const line = raw[i]!;
		if ((kind === "markdown" || kind === "html") && /^ {0,3}(```|~~~)/.test(line)) fence = !fence;
		const h = fence ? undefined : headingOf(kind, line, raw[i + 1]);
		if (h !== undefined) {
			sections.push({ heading: h, lines: [{ text: line, no: i + 1 }] });
			// Setext / rst underline belongs to the heading line.
			if (raw[i + 1] !== undefined && !/^\s*#/.test(line) && kind !== "org") {
				sections[sections.length - 1]!.lines.push({ text: raw[i + 1]!, no: i + 2 });
				i++;
			}
			continue;
		}
		sections[sections.length - 1]!.lines.push({ text: line, no: i + 1 });
	}
	const out: Chunk[] = [];
	// A heading with (almost) nothing under it joins the next section instead of becoming a tiny chunk.
	let pending: Line[] = [];
	for (let i = 0; i < sections.length; i++) {
		const s = sections[i]!;
		const lines = [...pending, ...s.lines];
		const bodyLen = s.lines.reduce((n, l) => n + l.text.trim().length, 0);
		const isLast = i === sections.length - 1;
		if (!isLast && s.heading && bodyLen < 60 && sections[i + 1]!.heading) {
			pending = lines;
			continue;
		}
		pending = [];
		sectionChunks(s.heading, lines, out);
	}
	return out;
}
