import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { badPathSyntax, relativeInside, resolveKnowledgeFile, resolveKnowledgePath } from "./path-guard";

let base: string;
let root: string;
let outside: string;

beforeAll(async () => {
	base = await realpath(await mkdtemp(join(tmpdir(), "od-kpg-")));
	root = join(base, "notes");
	outside = join(base, "secret");
	await mkdir(join(root, "sub"), { recursive: true });
	await mkdir(join(root, ".git"), { recursive: true });
	await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
	await mkdir(outside, { recursive: true });
	await mkdir(join(base, "notes-evil"), { recursive: true });
	await writeFile(join(root, "a.md"), "# A\n");
	await writeFile(join(root, "sub", "b.md"), "b");
	await writeFile(join(root, ".env"), "KEY=1");
	await writeFile(join(root, ".git", "config"), "x");
	await writeFile(join(root, "node_modules", "pkg", "i.md"), "x");
	await writeFile(join(outside, "passwd.txt"), "root");
	await writeFile(join(base, "notes-evil", "e.md"), "evil");
});
afterAll(async () => {
	await rm(base, { recursive: true, force: true });
});

describe("resolveKnowledgePath", () => {
	it("accepts absolute and relative paths inside an indexed folder", async () => {
		const abs = await resolveKnowledgeFile(join(root, "sub", "b.md"), [root]);
		expect(abs.ok && abs.rel).toBe(join("sub", "b.md"));
		const rel = await resolveKnowledgeFile(join("sub", "b.md"), [root]);
		expect(rel.ok && rel.resolved).toBe(join(root, "sub", "b.md"));
	});

	it("tries every root for relative paths", async () => {
		const r = await resolveKnowledgeFile("passwd.txt", [root, outside]);
		expect(r.ok && r.resolved).toBe(join(outside, "passwd.txt"));
	});

	it("rejects traversal out of the folder", async () => {
		for (const t of [
			join("..", "secret", "passwd.txt"),
			join(root, "..", "secret", "passwd.txt"),
			join(root, "sub", "..", "..", "secret", "passwd.txt"),
			outside,
			"/etc/passwd",
		]) {
			expect((await resolveKnowledgePath(t, [root])).ok, t).toBe(false);
		}
	});

	it("rejects a sibling folder that shares a name prefix", async () => {
		expect((await resolveKnowledgePath(join(base, "notes-evil", "e.md"), [root])).ok).toBe(false);
	});

	it("rejects the folder root itself and everything when nothing is indexed", async () => {
		expect((await resolveKnowledgePath(root, [root])).ok).toBe(false);
		expect((await resolveKnowledgePath(join(root, "a.md"), [])).ok).toBe(false);
	});

	it("rejects hidden files and generated folders inside the root", async () => {
		for (const t of [".env", join(".git", "config"), join("node_modules", "pkg", "i.md")]) {
			expect((await resolveKnowledgePath(join(root, t), [root])).ok, t).toBe(false);
		}
	});

	it("rejects missing files and directories for resolveKnowledgeFile", async () => {
		expect((await resolveKnowledgeFile(join(root, "nope.md"), [root])).ok).toBe(false);
		expect((await resolveKnowledgeFile(join(root, "sub"), [root])).ok).toBe(false);
	});

	it.skipIf(process.platform === "win32")("does not follow symlinks out of the folder", async () => {
		await symlink(outside, join(root, "linkdir"));
		await symlink(join(outside, "passwd.txt"), join(root, "link.txt"));
		expect((await resolveKnowledgePath(join(root, "linkdir", "passwd.txt"), [root])).ok).toBe(false);
		expect((await resolveKnowledgePath(join(root, "link.txt"), [root])).ok).toBe(false);
	});

	it.skipIf(process.platform === "win32")("allows a symlinked root that points at the real folder", async () => {
		const alias = join(base, "alias");
		await symlink(root, alias);
		const r = await resolveKnowledgeFile(join(alias, "a.md"), [alias]);
		expect(r.ok).toBe(true);
	});
});

describe("badPathSyntax", () => {
	it("rejects empty, NUL and huge paths", () => {
		expect(badPathSyntax("")).toBeTruthy();
		expect(badPathSyntax("   ")).toBeTruthy();
		expect(badPathSyntax("a\0b")).toBeTruthy();
		expect(badPathSyntax("x".repeat(5000))).toBeTruthy();
		expect(badPathSyntax(42 as unknown as string)).toBeTruthy();
		expect(badPathSyntax("notes/a.md")).toBeUndefined();
	});
});

describe("relativeInside with Windows paths", () => {
	const win = path.win32;
	const root = "C:\\Users\\Ada\\Notes";
	const rel = (t: string) => relativeInside(root, t, win);

	it("accepts files below the root and is case-insensitive", () => {
		expect(rel("C:\\Users\\Ada\\Notes\\sub\\a.md")).toBe("sub\\a.md");
		expect(rel("c:\\users\\ada\\notes\\A.md")).toBe("A.md");
		expect(rel(root)).toBe("");
	});

	it("rejects traversal, siblings, other drives and UNC paths", () => {
		expect(rel(win.resolve(root, "..\\Other\\a.md"))).toBeUndefined();
		expect(rel(win.resolve(root, "sub\\..\\..\\x.md"))).toBeUndefined();
		expect(rel("C:\\Users\\Ada\\Notes-evil\\a.md")).toBeUndefined();
		expect(rel("D:\\Users\\Ada\\Notes\\a.md")).toBeUndefined();
		expect(rel("\\\\server\\share\\Notes\\a.md")).toBeUndefined();
	});

	it("flags hidden segments written with backslashes", async () => {
		const { hasIgnoredSegment } = await import("./filter");
		expect(hasIgnoredSegment(rel("C:\\Users\\Ada\\Notes\\.git\\config")!)).toBe(true);
		expect(hasIgnoredSegment(rel("C:\\Users\\Ada\\Notes\\sub\\a.md")!)).toBe(false);
	});
});
