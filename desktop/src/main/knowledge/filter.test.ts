import { describe, expect, it } from "vitest";
import { classifyFile, hasIgnoredSegment, isIgnoredDir, looksBinary, MAX_FILE_BYTES } from "./filter";

describe("classifyFile", () => {
	it("indexes notes, data, html and source files", () => {
		for (const [name, kind] of [
			["a.md", "markdown"],
			["a.markdown", "markdown"],
			["a.TXT", "text"],
			["a.rst", "rst"],
			["a.org", "org"],
			["a.csv", "data"],
			["a.json", "data"],
			["a.html", "html"],
			["a.htm", "html"],
			["a.ts", "code"],
			["a.py", "code"],
		] as const)
			expect(classifyFile(name, 10)).toEqual({ index: true, kind });
	});

	it("skips PDFs, binaries, hidden files, lockfiles, empty and large files", () => {
		expect(classifyFile("paper.pdf", 10)).toEqual({ index: false, reason: "pdf" });
		expect(classifyFile("photo.png", 10)).toEqual({ index: false, reason: "unsupported" });
		expect(classifyFile("app.exe", 10)).toEqual({ index: false, reason: "unsupported" });
		expect(classifyFile(".env", 10)).toEqual({ index: false, reason: "hidden" });
		expect(classifyFile("~$report.txt", 10)).toEqual({ index: false, reason: "hidden" });
		expect(classifyFile("package-lock.json", 10)).toEqual({ index: false, reason: "unsupported" });
		expect(classifyFile("empty.md", 0)).toEqual({ index: false, reason: "empty" });
		expect(classifyFile("big.md", MAX_FILE_BYTES + 1)).toEqual({ index: false, reason: "too-large" });
		expect(classifyFile("edge.md", MAX_FILE_BYTES)).toEqual({ index: true, kind: "markdown" });
	});
});

describe("ignored folders", () => {
	it("skips hidden folders and node_modules", () => {
		expect(isIgnoredDir(".git")).toBe(true);
		expect(isIgnoredDir("node_modules")).toBe(true);
		expect(isIgnoredDir("Notes")).toBe(false);
	});

	it("finds ignored segments in POSIX and Windows relative paths", () => {
		expect(hasIgnoredSegment("a/b/c.md")).toBe(false);
		expect(hasIgnoredSegment("a/.git/config")).toBe(true);
		expect(hasIgnoredSegment("a\\node_modules\\x\\y.md")).toBe(true);
		expect(hasIgnoredSegment(".env")).toBe(true);
		expect(hasIgnoredSegment("a\\..hidden-ish\\x.md")).toBe(true);
		expect(hasIgnoredSegment("./a/b.md")).toBe(false);
	});
});

describe("looksBinary", () => {
	it("flags NUL bytes", () => {
		expect(looksBinary(Buffer.from([104, 105, 0, 1]))).toBe(true);
		expect(looksBinary(Buffer.from("hello"))).toBe(false);
	});
});
