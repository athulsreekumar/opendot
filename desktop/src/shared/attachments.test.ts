import { describe, expect, it } from "vitest";
import {
	composeUserText,
	detectKind,
	formatAttachmentBlock,
	INLINE_MAX_CHARS,
	isOpenSafe,
	looksBinary,
	MAX_FILE_BYTES,
	MAX_IMAGE_BYTES,
	mediaUrl,
	parseAttachmentBlocks,
	safeFileName,
	sizeError,
	sniffImageMime,
	truncateForInline,
	workspaceCopyName,
} from "./attachments";

describe("detectKind", () => {
	it("recognises images by extension and mime", () => {
		for (const n of ["a.png", "b.JPG", "c.jpeg", "d.gif", "e.webp"]) expect(detectKind(n)).toBe("image");
		expect(detectKind("clipboard", "image/png")).toBe("image");
		expect(detectKind("photo.heic", "image/heic")).toBe("file");
	});
	it("recognises text-like files", () => {
		for (const n of ["a.txt", "b.md", "c.csv", "d.json", "e.ts", "f.html", "g.xml", "h.yaml", "i.log", "Dockerfile"])
			expect(detectKind(n)).toBe("text");
		expect(detectKind("data", "text/plain")).toBe("text");
		expect(detectKind("x", "application/json")).toBe("text");
	});
	it("treats everything else as a file", () => {
		for (const n of ["a.pdf", "b.docx", "c.zip", "d.exe", "noext"]) expect(detectKind(n)).toBe("file");
	});
});

describe("limits", () => {
	it("allows up to 20 MB for images and 10 MB for the rest", () => {
		expect(sizeError("a.png", "image", MAX_IMAGE_BYTES)).toBeUndefined();
		expect(sizeError("a.png", "image", MAX_IMAGE_BYTES + 1)).toBe("a.png is over 20 MB. Choose a smaller image.");
		expect(sizeError("a.txt", "text", MAX_FILE_BYTES)).toBeUndefined();
		expect(sizeError("a.pdf", "file", MAX_FILE_BYTES + 1)).toBe("a.pdf is over 10 MB. Choose a smaller file.");
	});
	it("never uses an em dash in copy", () => {
		expect(sizeError("a.png", "image", MAX_IMAGE_BYTES + 1)).not.toContain("—");
	});
});

describe("content sniffing", () => {
	it("checks image magic numbers", () => {
		expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
		expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
		expect(sniffImageMime(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
		expect(sniffImageMime(new TextEncoder().encode("not an image"))).toBeUndefined();
	});
	it("spots binary data", () => {
		expect(looksBinary(new Uint8Array([104, 105, 0, 1]))).toBe(true);
		expect(looksBinary(new TextEncoder().encode("hello"))).toBe(false);
	});
});

describe("workspace copy names", () => {
	it("is prefixed with the timestamp", () => {
		expect(workspaceCopyName(1700000000000, "notes.txt")).toBe("20231114T221320-notes.txt");
		expect(workspaceCopyName(1700000000000, "notes.txt", 1)).toBe("20231114T221320-2-notes.txt");
	});
	it("never produces a long digit run that the card detector could mask", () => {
		expect(workspaceCopyName(Date.now(), "a.txt")).not.toMatch(/\d{9}/);
	});
	it("replaces characters Windows forbids and strips paths", () => {
		expect(safeFileName('a<b>c:d"e|f?g*h.txt')).toBe("a_b_c_d_e_f_g_h.txt");
		expect(safeFileName("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
		expect(safeFileName("../../etc/passwd")).toBe("passwd");
	});
	it("handles reserved names, trailing dots and empty names", () => {
		expect(safeFileName("CON")).toBe("_CON");
		expect(safeFileName("nul.txt")).toBe("_nul.txt");
		expect(safeFileName("report. ")).toBe("report");
		expect(safeFileName("...")).toBe("file");
		expect(safeFileName("")).toBe("file");
	});
	it("keeps the extension when shortening long names", () => {
		const n = safeFileName(`${"a".repeat(300)}.csv`);
		expect(n.length).toBeLessThanOrEqual(100);
		expect(n.endsWith(".csv")).toBe(true);
	});
	it("never contains a separator", () => {
		expect(safeFileName("a/b\\c.txt")).not.toMatch(/[\\/]/);
	});
});

describe("inlining", () => {
	it("truncates long text and says so", () => {
		const t = truncateForInline("x".repeat(INLINE_MAX_CHARS + 10));
		expect(t.truncated).toBe(true);
		expect(t.text.length).toBe(INLINE_MAX_CHARS);
		expect(truncateForInline("short")).toEqual({ text: "short", truncated: false });
	});
	it("round-trips blocks and strips them from the visible text", () => {
		const block = formatAttachmentBlock(
			{ name: "a.txt", kind: "text", size: 5, path: "attachments/1-a.txt" },
			"hello\nworld",
		);
		const img = formatAttachmentBlock({ name: "p.png", kind: "image", path: "attachments/2-p.png" }, "note");
		const msg = composeUserText("look at these", [block, img]);
		const parsed = parseAttachmentBlocks(msg, "dot_1");
		expect(parsed.text).toBe("look at these");
		expect(parsed.attachments.map((a) => a.name)).toEqual(["a.txt", "p.png"]);
		expect(parsed.attachments[1]?.url).toBe(mediaUrl("dot_1", "attachments/2-p.png"));
		expect(parsed.attachments[0]?.url).toBeUndefined();
	});
	it("survives odd file names and content that looks like a delimiter", () => {
		const block = formatAttachmentBlock({ name: "weird]].txt", kind: "text" }, "before [[/opendot:attachment]] after");
		const parsed = parseAttachmentBlocks(`hi\n\n${block}`);
		expect(parsed.text).toBe("hi");
		expect(parsed.attachments[0]?.name).toBe("weird]].txt");
	});
	it("leaves plain messages alone", () => {
		expect(parseAttachmentBlocks("just text")).toEqual({ text: "just text", attachments: [] });
	});
	it("shows only the attachments when nothing was typed", () => {
		const parsed = parseAttachmentBlocks(
			composeUserText("  ", [formatAttachmentBlock({ name: "a.md", kind: "text" }, "x")]),
		);
		expect(parsed.text).toBe("");
		expect(parsed.attachments).toHaveLength(1);
	});
});

describe("isOpenSafe", () => {
	it("opens documents and images but never scripts or programs", () => {
		for (const n of ["a.pdf", "b.docx", "c.png", "d.txt", "e.csv"]) expect(isOpenSafe(n)).toBe(true);
		for (const n of ["a.exe", "b.bat", "c.sh", "d.ps1", "e.app", "f.js", "g.py", "h.lnk"])
			expect(isOpenSafe(n)).toBe(false);
	});
});
