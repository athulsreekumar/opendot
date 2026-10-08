import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** The site uses line icons (lucide), never emoji. Typographic symbols such as → ↓ ✓ ↻ • are fine. */
const ROOT = new URL("../../", import.meta.url).pathname;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}|\u{200D}/u;
const ALLOWED_SYMBOLS = /[✓✔✕✖✗✘]/gu; // check marks and crosses used as text glyphs
const TEXT_EXT = new Set([".ts", ".tsx", ".css", ".md", ".mdx", ".json", ".txt", ".html", ".mjs", ".js", ".svg"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "shots", "capture", "desktop"]);

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (SKIP_DIRS.has(name)) continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (TEXT_EXT.has(extname(name))) out.push(p);
	}
	return out;
}

describe("no emoji on the website", () => {
	const files = [
		...walk(join(ROOT, "app")),
		...walk(join(ROOT, "components")),
		...walk(join(ROOT, "lib")),
		join(ROOT, "public/llms.txt"),
		join(ROOT, "README.md"),
	];

	it("scans the source", () => {
		expect(files.length).toBeGreaterThan(50);
	});

	it("has no emoji in app, components, lib, llms.txt or README", () => {
		const hits: string[] = [];
		for (const f of files) {
			const lines = readFileSync(f, "utf8").split("\n");
			lines.forEach((line, i) => {
				const m = line.replace(ALLOWED_SYMBOLS, "").match(EMOJI);
				if (m) hits.push(`${relative(ROOT, f)}:${i + 1} ${m[0]}`);
			});
		}
		expect(hits).toEqual([]);
	});
});
