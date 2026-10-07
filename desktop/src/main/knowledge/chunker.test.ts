import { describe, expect, it } from "vitest";
import { chunkText, htmlToText, TARGET_CHARS } from "./chunker";

const para = (n: number, word = "word") => Array.from({ length: n }, (_, i) => `${word}${i}`).join(" ");

describe("chunkText markdown", () => {
	it("starts a chunk at each heading and records heading and line range", () => {
		const md = [
			"# Title",
			"",
			"Intro paragraph about apples and pears in the orchard today.",
			"",
			"## Plans",
			"",
			"We will plant new trees next spring and water them weekly.",
			"",
			"## Budget",
			"",
			"Money matters for the orchard, so we track every purchase.",
		].join("\n");
		const chunks = chunkText(md, "markdown");
		expect(chunks.map((c) => c.heading)).toEqual(["Title", "Plans", "Budget"]);
		expect(chunks[1]!.startLine).toBe(5);
		expect(chunks[1]!.endLine).toBe(7);
		expect(chunks[2]!.text).toContain("track every purchase");
	});

	it("ignores # lines inside code fences", () => {
		const md =
			"# Real\n\ntext before the code that is long enough to count as a body here.\n\n```sh\n# not a heading\nls\n```\n";
		const chunks = chunkText(md, "markdown");
		expect(chunks.map((c) => c.heading)).toEqual(["Real"]);
	});

	it("merges a heading with almost no body into the next section", () => {
		const md = "# A\n## B\n\nBody of B is long enough to stand alone as a real chunk of text.\n";
		const chunks = chunkText(md, "markdown");
		expect(chunks).toHaveLength(1);
		expect(chunks[0]!.heading).toBe("B");
		expect(chunks[0]!.text).toContain("# A");
		expect(chunks[0]!.startLine).toBe(1);
	});

	it("splits long sections near the target size, with overlap", () => {
		const lines = Array.from({ length: 60 }, (_, i) => `line ${i} ${para(8, `w${i}x`)}`);
		const chunks = chunkText(["# Long", ...lines].join("\n"), "markdown");
		expect(chunks.length).toBeGreaterThan(3);
		for (const c of chunks) {
			expect(c.text.length).toBeLessThanOrEqual(TARGET_CHARS + 120);
			expect(c.heading).toBe("Long");
		}
		// Consecutive chunks share a line (overlap) and cover everything.
		for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.startLine).toBeLessThanOrEqual(chunks[i - 1]!.endLine);
		expect(chunks[chunks.length - 1]!.endLine).toBe(61);
	});

	it("splits one huge line", () => {
		const chunks = chunkText(para(2000), "text");
		expect(chunks.length).toBeGreaterThan(5);
		expect(chunks.every((c) => c.startLine === 1 && c.endLine === 1)).toBe(true);
	});

	it("handles CRLF and empty input", () => {
		const c = chunkText(
			"# H\r\n\r\nsome text on a windows line ending that is long enough to keep around\r\n",
			"markdown",
		);
		expect(c[0]!.text).not.toContain("\r");
		expect(chunkText("", "text")).toEqual([]);
		expect(chunkText("\n\n  \n", "text")).toEqual([]);
	});

	it("finds org and rst headings", () => {
		const org = chunkText(
			"* Top\nbody text for the top section is long enough to keep here ok\n** Sub\nsub body text is also long enough to be kept as chunk text\n",
			"org",
		);
		expect(org.map((c) => c.heading)).toEqual(["Top", "Sub"]);
		const rst = chunkText(
			"Intro\n=====\n\nsome rst body that is long enough to stay around as text.\n\nNext\n----\n\nmore rst body that is long enough to stay around as text.\n",
			"rst",
		);
		expect(rst.map((c) => c.heading)).toEqual(["Intro", "Next"]);
	});
});

describe("htmlToText", () => {
	it("strips tags, scripts and styles, keeps headings and decodes entities", () => {
		const t = htmlToText(
			"<html><head><title>x</title><style>p{}</style></head><body><h1>Hello &amp; welcome</h1><p>First <b>bold</b> para.</p><script>alert(1)</script><ul><li>one</li><li>two&nbsp;&#33;</li></ul></body></html>",
		);
		expect(t).toContain("# Hello & welcome");
		expect(t).toContain("First bold para.");
		expect(t).toContain("- one");
		expect(t).toContain("two !");
		expect(t).not.toMatch(/alert|<|p\{\}/);
	});

	it("chunks html by its headings", () => {
		const c = chunkText(
			"<h1>One</h1><p>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</p><h2>Two</h2><p>bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb</p>",
			"html",
		);
		expect(c.map((x) => x.heading)).toEqual(["One", "Two"]);
	});
});
