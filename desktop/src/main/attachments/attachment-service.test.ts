import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INLINE_MAX_CHARS, MAX_ATTACHMENTS, MAX_IMAGE_BYTES, parseAttachmentBlocks } from "../../shared/attachments";
import type { Dot } from "../../shared/types";
import { createPaths } from "../paths";
import { AttachmentService, guardAttachmentPath } from "./attachment-service";

let root: string;
let ws: string;
let svc: AttachmentService;
const dot = () => ({ id: "dot_abc123", workspaceDir: ws }) as unknown as Dot;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const bytes = (s: string) => new TextEncoder().encode(s);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "att-test-"));
	ws = join(root, "dots", "dot_abc123", "workspace");
	await mkdir(ws, { recursive: true });
	svc = new AttachmentService({ paths: createPaths(root), supportsImages: async () => true });
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("staging", () => {
	it("stages text, image and binary files with the right kinds", async () => {
		const t = await svc.stageBytes({ name: "notes.txt", data: bytes("hello") });
		const i = await svc.stageBytes({ name: "pic.png", data: png });
		const p = await svc.stageBytes({ name: "doc.pdf", data: bytes("%PDF-1.4") });
		expect(t.ok && t.attachment.kind).toBe("text");
		expect(i.ok && i.attachment.kind).toBe("image");
		expect(i.ok && i.attachment.previewUrl).toMatch(/^opendot-media:\/\/x\/staged\/att_/);
		expect(p.ok && p.attachment.kind).toBe("file");
	});
	it("handles content that does not match its name", async () => {
		const fake = await svc.stageBytes({ name: "fake.png", data: bytes("not really a png") });
		expect(fake.ok && fake.attachment.kind).toBe("file");
		const bin = await svc.stageBytes({ name: "data.txt", data: new Uint8Array([1, 0, 2, 0]) });
		expect(bin.ok && bin.attachment.kind).toBe("file");
	});
	it("rejects oversized and empty files with friendly copy", async () => {
		const hugeImage = new Uint8Array(MAX_IMAGE_BYTES + 1);
		hugeImage.set(png);
		const big = await svc.stageBytes({ name: "huge.png", data: hugeImage });
		expect(big).toMatchObject({ ok: false, error: "huge.png is over 20 MB. Choose a smaller image." });
		const bigText = await svc.stageBytes({ name: "big.txt", data: new Uint8Array(10 * 1024 * 1024 + 1).fill(97) });
		expect(bigText).toMatchObject({ ok: false, error: "big.txt is over 10 MB. Choose a smaller file." });
		expect(await svc.stageBytes({ name: "e.txt", data: new Uint8Array() })).toMatchObject({ ok: false });
	});
	it("enforces the per-message count", async () => {
		const r = await svc.stageBytes({ name: "a.txt", data: bytes("x") }, MAX_ATTACHMENTS);
		expect(r).toMatchObject({ ok: false, error: "You can attach up to 10 files to one message." });
	});
	it("rejects folders", async () => {
		const dir = join(root, "somefolder");
		await mkdir(dir);
		expect(await svc.stagePath(dir)).toMatchObject({
			ok: false,
			error: expect.stringContaining("Folders can't be attached"),
		});
	});
	it("stages a picked file from disk", async () => {
		const f = join(root, "picked.md");
		await writeFile(f, "# hi");
		const r = await svc.stagePath(f);
		expect(r.ok && r.attachment.name).toBe("picked.md");
	});
	it("ignores unknown ids and forgets drafts after taking them", async () => {
		const r = await svc.stageBytes({ name: "a.txt", data: bytes("x") });
		if (!r.ok) throw new Error("stage failed");
		await expect(svc.take(["att_00000000-0000-0000-0000-000000000000"])).rejects.toThrow(/no longer available/);
		await expect(svc.take(["../../etc/passwd"])).rejects.toThrow();
		expect((await svc.take([r.attachment.id]))[0]?.name).toBe("a.txt");
		await expect(svc.take([r.attachment.id])).rejects.toThrow();
	});
});

describe("render", () => {
	it("inlines text in a delimited block and copies it into the workspace", async () => {
		const out = await svc.render(
			dot(),
			"summarise",
			[{ name: "a.csv", kind: "text", mime: "text/csv", bytes: bytes("x,y\n1,2") }],
			{
				supportsImages: true,
			},
		);
		expect(out.text.startsWith("summarise\n\n[[opendot:attachment ")).toBe(true);
		expect(out.text).toContain("x,y\n1,2");
		const files = await readdir(join(ws, "attachments"));
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/^\d{8}T\d{6}-a\.csv$/);
		expect(await readFile(join(ws, "attachments", files[0]!), "utf8")).toBe("x,y\n1,2");
		const parsed = parseAttachmentBlocks(out.text, "dot_abc123");
		expect(parsed.text).toBe("summarise");
		expect(parsed.attachments[0]).toMatchObject({ name: "a.csv", kind: "text", path: `attachments/${files[0]}` });
	});
	it("truncates very long text with a note, but copies the whole file", async () => {
		const long = "a".repeat(INLINE_MAX_CHARS + 500);
		const out = await svc.render(
			dot(),
			"",
			[{ name: "long.log", kind: "text", mime: "text/plain", bytes: bytes(long) }],
			{
				supportsImages: true,
			},
		);
		expect(out.text).toContain("[Truncated: showing the first");
		expect(out.text.length).toBeLessThan(long.length);
		const f = (await readdir(join(ws, "attachments")))[0]!;
		expect((await readFile(join(ws, "attachments", f), "utf8")).length).toBe(long.length);
		expect(parseAttachmentBlocks(out.text).attachments[0]?.truncated).toBe(true);
	});
	it("sends images as image content when the model can see them", async () => {
		const out = await svc.render(
			dot(),
			"what is this",
			[{ name: "p.png", kind: "image", mime: "image/png", bytes: png }],
			{
				supportsImages: true,
			},
		);
		expect(out.images).toEqual([{ type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" }]);
		expect(out.text).not.toContain("file reference");
	});
	it("sends images as file references for text-only models or on request", async () => {
		for (const opts of [{ supportsImages: false }, { supportsImages: true, imagesAsFiles: true }]) {
			const out = await svc.render(dot(), "", [{ name: "p.png", kind: "image", mime: "image/png", bytes: png }], opts);
			expect(out.images).toEqual([]);
			expect(out.text).toContain("You can't see it");
			expect(parseAttachmentBlocks(out.text).attachments[0]?.asReference).toBe(true);
		}
	});
	it("tells the Dot where a binary file is", async () => {
		const out = await svc.render(
			dot(),
			"read this",
			[{ name: "Report 2026.pdf", kind: "file", mime: "application/pdf", bytes: bytes("%PDF") }],
			{
				supportsImages: true,
			},
		);
		expect(out.text).toMatch(/saved at attachments\/\d{8}T\d{6}-Report 2026\.pdf in your workspace/);
		expect(out.images).toEqual([]);
	});
	it("uses Windows-safe names and never overwrites", async () => {
		const items = [
			{ name: "a:b.txt", kind: "text" as const, mime: "text/plain", bytes: bytes("1") },
			{ name: "a:b.txt", kind: "text" as const, mime: "text/plain", bytes: bytes("2") },
		];
		await svc.render(dot(), "", items, { supportsImages: true });
		const files = (await readdir(join(ws, "attachments"))).sort();
		expect(files).toHaveLength(2);
		for (const f of files) expect(f).not.toMatch(/[<>:"|?*]/);
	});
});

describe("path guard and media", () => {
	it("only resolves attachments/<file> inside the workspace", () => {
		expect(guardAttachmentPath(ws, "attachments/1-a.txt")).toBe(join(ws, "attachments", "1-a.txt"));
		expect(guardAttachmentPath(ws, "attachments\\1-a.txt")).toBe(join(ws, "attachments", "1-a.txt"));
		for (const bad of [
			"../x",
			"attachments/../x",
			"attachments/..",
			"/etc/passwd",
			"other/1-a.txt",
			"attachments/a/b",
			"attachments/",
		])
			expect(guardAttachmentPath(ws, bad)).toBeUndefined();
	});
	it("serves workspace images and staged images, nothing else", async () => {
		await svc.render(dot(), "", [{ name: "p.png", kind: "image", mime: "image/png", bytes: png }], {
			supportsImages: true,
		});
		const name = (await readdir(join(ws, "attachments")))[0]!;
		const workspaceOf = async (id: string) => (id === "dot_abc123" ? ws : undefined);
		const hit = await svc.resolveMedia(`opendot-media://x/dot/dot_abc123/${encodeURIComponent(name)}`, workspaceOf);
		expect(hit?.mime).toBe("image/png");
		expect(existsSync(hit!.file)).toBe(true);
		expect(await svc.resolveMedia(`opendot-media://x/dot/other/${name}`, workspaceOf)).toBeUndefined();
		expect(
			await svc.resolveMedia("opendot-media://x/dot/dot_abc123/..%2F..%2Fsettings.json", workspaceOf),
		).toBeUndefined();
		expect(await svc.resolveMedia("opendot-media://x/dot/dot_abc123/x.html", workspaceOf)).toBeUndefined();
		const st = await svc.stageBytes({ name: "s.png", data: png });
		if (!st.ok) throw new Error("stage failed");
		expect((await svc.resolveMedia(st.attachment.previewUrl!, workspaceOf))?.mime).toBe("image/png");
		const txt = await svc.stageBytes({ name: "s.txt", data: bytes("x") });
		if (!txt.ok) throw new Error("stage failed");
		expect(await svc.resolveMedia(`opendot-media://x/staged/${txt.attachment.id}`, workspaceOf)).toBeUndefined();
	});
});
