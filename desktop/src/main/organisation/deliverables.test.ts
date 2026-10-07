import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	collectDeliverables,
	isSafeRelativePath,
	readTextDeliverables,
	resolveWorkspaceFile,
	snapshotTaskFiles,
	taskFolder,
} from "./deliverables";

let base: string;
let ws: string;
beforeEach(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "opendot-deliv-")));
	ws = join(base, "workspace");
	mkdirSync(join(ws, "projects", "prj_a", "t1"), { recursive: true });
	writeFileSync(join(ws, "projects", "prj_a", "t1", "report.md"), "# Report\nhello");
	writeFileSync(join(base, "secret.txt"), "secret");
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

describe("resolveWorkspaceFile", () => {
	it("resolves a plain relative file", async () => {
		const f = await resolveWorkspaceFile(ws, "projects/prj_a/t1/report.md");
		expect(f).toBeTruthy();
		expect(f!.endsWith(join("t1", "report.md"))).toBe(true);
	});

	it("rejects traversal, absolute and Windows-style paths", async () => {
		const bad = [
			"../secret.txt",
			"projects/../../secret.txt",
			"projects\\..\\..\\secret.txt",
			"..\\secret.txt",
			join(base, "secret.txt"),
			"/etc/passwd",
			"\\etc\\passwd",
			"C:\\Windows\\win.ini",
			"c:/Windows/win.ini",
			"C:win.ini",
			"\\\\server\\share\\file.txt",
			"//server/share/file.txt",
			"projects/prj_a/t1/report.md\0.png",
			"",
		];
		for (const p of bad) {
			expect(isSafeRelativePath(p), p).toBe(false);
			expect(await resolveWorkspaceFile(ws, p), p).toBeUndefined();
		}
	});

	it("rejects a missing file, a directory and the workspace itself", async () => {
		expect(await resolveWorkspaceFile(ws, "projects/prj_a/t1/nope.md")).toBeUndefined();
		expect(await resolveWorkspaceFile(ws, "projects/prj_a/t1")).toBeUndefined();
		expect(await resolveWorkspaceFile(ws, ".")).toBeUndefined();
	});

	it("rejects a symbolic link that leaves the workspace", async () => {
		try {
			symlinkSync(join(base, "secret.txt"), join(ws, "projects", "prj_a", "t1", "link.txt"));
			symlinkSync(base, join(ws, "projects", "escape"));
		} catch {
			return; // symlinks need privileges on some Windows setups
		}
		expect(await resolveWorkspaceFile(ws, "projects/prj_a/t1/link.txt")).toBeUndefined();
		expect(await resolveWorkspaceFile(ws, "projects/escape/secret.txt")).toBeUndefined();
	});

	it("allows a symbolic link that stays inside the workspace", async () => {
		try {
			symlinkSync(join(ws, "projects", "prj_a", "t1", "report.md"), join(ws, "alias.md"));
		} catch {
			return;
		}
		expect(await resolveWorkspaceFile(ws, "alias.md")).toBeTruthy();
	});
});

describe("collectDeliverables", () => {
	it("lists files recursively, skips hidden files, links and honours the 'new or changed' rule", async () => {
		const folder = join(ws, "projects", "prj_a", "t1");
		const before = await snapshotTaskFiles(ws, "prj_a", "t1");
		expect([...before.keys()]).toEqual(["projects/prj_a/t1/report.md"]);
		mkdirSync(join(folder, "deep", "er"), { recursive: true });
		writeFileSync(join(folder, "deep", "er", "x.txt"), "x");
		writeFileSync(join(folder, ".secret"), "x");
		mkdirSync(join(folder, ".git"));
		writeFileSync(join(folder, ".git", "config"), "x");
		try {
			symlinkSync(join(base, "secret.txt"), join(folder, "link.txt"));
		} catch {
			// ignore
		}
		const out = await collectDeliverables(ws, "prj_a", "t1", before, []);
		expect(out.map((d) => d.path)).toEqual(["projects/prj_a/t1/deep/er/x.txt"]);
		expect(out[0]).toEqual({ kind: "file", title: "x.txt", path: "projects/prj_a/t1/deep/er/x.txt" });
	});

	it("keeps earlier entries and replaces the same path in place", async () => {
		const existing = [
			{ kind: "file" as const, title: "report.md", path: "projects/prj_a/t1/report.md" },
			{ kind: "link" as const, title: "Doc", url: "https://example.com" },
		];
		const out = await collectDeliverables(ws, "prj_a", "t1", undefined, existing);
		expect(out.map((d) => d.title)).toEqual(["report.md", "Doc"]);
	});

	it("caps the list at 50 files", async () => {
		const folder = join(ws, "projects", "prj_a", "t2");
		mkdirSync(folder, { recursive: true });
		for (let i = 0; i < 80; i++) writeFileSync(join(folder, `f${String(i).padStart(2, "0")}.txt`), "x");
		expect((await collectDeliverables(ws, "prj_a", "t2", new Map(), [])).length).toBe(50);
	});

	it("returns nothing when the task folder does not exist", async () => {
		expect(await collectDeliverables(ws, "prj_a", "t9", new Map(), [])).toEqual([]);
		expect(taskFolder("prj_a", "t9")).toBe("projects/prj_a/t9");
	});
});

describe("readTextDeliverables", () => {
	it("reads small text files up to the limit and skips other types", async () => {
		const folder = join(ws, "projects", "prj_a", "t1");
		writeFileSync(join(folder, "image.png"), "binary");
		writeFileSync(join(folder, "long.txt"), "y".repeat(9000));
		const files = [
			{ kind: "file" as const, title: "report.md", path: "projects/prj_a/t1/report.md" },
			{ kind: "file" as const, title: "image.png", path: "projects/prj_a/t1/image.png" },
			{ kind: "file" as const, title: "long.txt", path: "projects/prj_a/t1/long.txt" },
			{ kind: "file" as const, title: "gone.md", path: "projects/prj_a/t1/gone.md" },
			{ kind: "file" as const, title: "evil.md", path: "../secret.txt" },
		];
		const out = await readTextDeliverables(ws, files, 6000);
		expect(out.map((x) => x.title)).toEqual(["report.md", "long.txt"]);
		expect(out[0]!.text).toContain("hello");
		expect(out.reduce((n, x) => n + x.text.length, 0)).toBeLessThanOrEqual(6000);
	});
});
