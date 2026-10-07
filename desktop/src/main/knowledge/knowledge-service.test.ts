import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { KnowledgeState } from "../../shared/types";
import { KnowledgeService } from "./knowledge-service";
import { formatSearch, knowledgeTools } from "./tools";

let base: string;
let notes: string;
let dataDir: string;
let svc: KnowledgeService | undefined;
const current = (): KnowledgeService => svc!;
let states: KnowledgeState[];

const make = (watch = false) =>
	new KnowledgeService({ dir: dataDir, emit: (s) => states.push(s), watch, watchDebounceMs: 50 });

async function settle(s: KnowledgeService, id?: string) {
	await s.reindex(id);
	for (let i = 0; i < 200 && s.busy(); i++) await new Promise((r) => setTimeout(r, 10));
}

beforeEach(async () => {
	base = await mkdtemp(join(tmpdir(), "od-know-"));
	notes = join(base, "notes");
	dataDir = join(base, "data", "knowledge");
	states = [];
	await mkdir(join(notes, "sub"), { recursive: true });
	await writeFile(
		join(notes, "sourdough.md"),
		"# Sourdough\n\nMix rye flour and water, then feed the starter every morning.\n\n## Baking\n\nBake the bread at 230 degrees for forty minutes with steam.\n",
	);
	await writeFile(
		join(notes, "sub", "budget.txt"),
		"Quarterly budget review.\nRevenue is up and travel costs are down this quarter.\n",
	);
	await writeFile(
		join(notes, "page.html"),
		"<h1>Garden</h1><p>Plant tomatoes after the last frost in spring, and water them weekly.</p>",
	);
});
afterEach(async () => {
	await svc?.stop();
	svc = undefined;
	await rm(base, { recursive: true, force: true });
});

describe("KnowledgeService indexing", () => {
	it("indexes a folder and reports counts, sizes and status", async () => {
		svc = make();
		await svc.start();
		await writeFile(join(notes, "paper.pdf"), "%PDF-1.4");
		await writeFile(join(notes, "pic.png"), Buffer.from([0x89, 0x50, 0, 1]));
		await writeFile(join(notes, "big.md"), "x".repeat(2 * 1024 * 1024 + 1));
		await mkdir(join(notes, "node_modules", "p"), { recursive: true });
		await writeFile(join(notes, "node_modules", "p", "n.md"), "ignored text here");
		await mkdir(join(notes, ".git"), { recursive: true });
		await writeFile(join(notes, ".git", "g.md"), "ignored text here");
		await writeFile(join(notes, ".hidden.md"), "ignored text here");
		await writeFile(join(notes, "binary.txt"), Buffer.from([65, 66, 0, 67]));
		const f = await svc.addFolder(notes);
		await settle(svc);
		const v = svc.state().folders.find((x) => x.id === f.id)!;
		expect(v.status).toBe("ready");
		expect(v.fileCount).toBe(3);
		expect(v.chunkCount).toBeGreaterThanOrEqual(4);
		expect(v.totalBytes).toBeGreaterThan(100);
		expect(v.lastIndexedAt).toBeTruthy();
		expect(v.skipped.pdf).toBe(1);
		expect(v.skipped.tooLarge).toBe(1);
		expect(v.skipped.other).toBeGreaterThanOrEqual(2); // png + binary.txt
		expect(states.some((s) => s.folders[0]?.status === "indexing")).toBe(true);
		expect(await svc.search("ignored")).toEqual([]);
	});

	it("does not follow symlinks", async () => {
		if (process.platform === "win32") return;
		const outside = join(base, "outside");
		await mkdir(outside);
		await writeFile(join(outside, "secret.md"), "# Secret\n\nthe launch code is swordfish");
		await symlink(outside, join(notes, "link"));
		await symlink(join(outside, "secret.md"), join(notes, "file-link.md"));
		svc = make();
		await svc.start();
		await svc.addFolder(notes);
		await settle(svc);
		expect(await svc.search("swordfish")).toEqual([]);
	});

	it("rejects things that are not folders and duplicates or nested folders", async () => {
		svc = make();
		await svc.start();
		await expect(svc.addFolder(join(notes, "sourdough.md"))).rejects.toThrow(/folder/);
		await expect(svc.addFolder(join(base, "missing"))).rejects.toThrow(/folder/);
		const a = await svc.addFolder(notes);
		expect((await svc.addFolder(notes)).id).toBe(a.id);
		await expect(svc.addFolder(join(notes, "sub"))).rejects.toThrow(/already covered/);
		expect(svc.state().folders).toHaveLength(1);
		// A parent replaces what it contains.
		const parent = await svc.addFolder(base);
		expect(svc.state().folders.map((f) => f.id)).toEqual([parent.id]);
	});

	it("re-indexes only changed files (mtime + size) and drops deleted ones", async () => {
		svc = make();
		await svc.start();
		await svc.addFolder(notes);
		await settle(svc);
		const idsBefore = (svc as unknown as { nextId: number }).nextId;
		await settle(svc);
		expect((svc as unknown as { nextId: number }).nextId).toBe(idsBefore); // nothing re-read

		// Change one file and keep its mtime in the future so the change is certain to register.
		await writeFile(
			join(notes, "sub", "budget.txt"),
			"Quarterly budget review.\nNow mentioning the zeppelin purchase.\n",
		);
		await utimes(join(notes, "sub", "budget.txt"), new Date(), new Date(Date.now() + 5000));
		await settle(svc);
		const after = (svc as unknown as { nextId: number }).nextId;
		expect(after).toBeGreaterThan(idsBefore);
		expect(after - idsBefore).toBeLessThanOrEqual(2); // only budget.txt's chunks
		expect((await svc.search("zeppelin"))[0]?.name).toBe("budget.txt");
		expect(await svc.search("travel costs")).toEqual([]);

		await rm(join(notes, "sourdough.md"));
		await settle(svc);
		expect(await svc.search("sourdough")).toEqual([]);
		expect(svc.state().folders[0]!.fileCount).toBe(2);

		await writeFile(join(notes, "new.md"), "# New\n\nA brand new note about telescopes and stars.\n");
		await settle(svc);
		expect((await svc.search("telescopes"))[0]?.name).toBe("new.md");
	});

	it("picks up changes through the folder watcher", async () => {
		svc = make(true);
		await svc.start();
		await svc.addFolder(notes);
		await settle(svc);
		await writeFile(join(notes, "watched.md"), "# Watched\n\nThe aardvark appeared after the watcher started.\n");
		let hits: Awaited<ReturnType<typeof svc.search>> = [];
		for (let i = 0; i < 100 && !hits.length; i++) {
			await new Promise((r) => setTimeout(r, 50));
			hits = await svc.search("aardvark");
		}
		expect(hits[0]?.name).toBe("watched.md");
	});

	it("persists the index and reloads it without re-reading files", async () => {
		svc = make();
		await svc.start();
		const f = await svc.addFolder(notes);
		await settle(svc);
		await svc.stop();
		expect(JSON.parse(await readFile(join(dataDir, "folders.json"), "utf8")).folders[0].id).toBe(f.id);
		expect((await stat(join(dataDir, `index-${f.id}.json`))).size).toBeGreaterThan(100);

		svc = make();
		await svc.start();
		// Loaded from disk before the incremental scan finishes.
		expect((await svc.search("sourdough starter"))[0]?.name).toBe("sourdough.md");
		await settle(svc);
		expect(svc.state().folders[0]).toMatchObject({ id: f.id, fileCount: 3, status: "ready" });
	});

	it("reports a missing folder as an error and removes folders cleanly", async () => {
		svc = make();
		await svc.start();
		const f = await svc.addFolder(notes);
		await settle(svc);
		await rm(notes, { recursive: true, force: true });
		await settle(svc);
		expect(svc.state().folders[0]!.status).toBe("error");
		expect(svc.state().folders[0]!.error).toMatch(/can't be found/);
		await svc.removeFolder(f.id);
		expect(svc.state().folders).toEqual([]);
		expect(await svc.search("sourdough")).toEqual([]);
	});
});

describe("KnowledgeService search", () => {
	beforeEach(async () => {
		svc = make();
		await svc.start();
		await svc.addFolder(notes);
		await settle(svc);
	});

	it("ranks the right passage first and returns path, heading and line range", async () => {
		const svc = current();
		const hits = await svc.search("bake bread steam");
		expect(hits[0]).toMatchObject({ name: "sourdough.md", heading: "Baking", path: join(notes, "sourdough.md") });
		expect(hits[0]!.startLine).toBe(5);
		expect(hits[0]!.endLine).toBe(7);
		expect(hits[0]!.snippet).toContain("230 degrees");
		expect((await svc.search("travel costs revenue"))[0]!.name).toBe("budget.txt");
		expect((await svc.search("tomatoes frost"))[0]).toMatchObject({ name: "page.html", heading: "Garden" });
	});

	it("honours the limit and caps passages per file", async () => {
		await writeFile(
			join(notes, "many.md"),
			Array.from(
				{ length: 12 },
				(_, i) => `# Part ${i}\n\nzebra stripes number ${i} are black and white and very distinctive.\n`,
			).join("\n"),
		);
		await settle(svc!);
		const hits = await svc!.search("zebra stripes", 10);
		expect(hits.filter((h) => h.name === "many.md").length).toBeLessThanOrEqual(2);
		expect((await svc!.search("zebra", 1)).length).toBe(1);
	});
});

describe("KnowledgeService read and open", () => {
	beforeEach(async () => {
		svc = make();
		await svc.start();
		await svc.addFolder(notes);
		await settle(svc);
	});

	it("reads a line range and the text of html files", async () => {
		const r = await svc!.read(join(notes, "sourdough.md"), 5, 7);
		expect(r).toMatchObject({ startLine: 5, endLine: 7, name: "sourdough.md" });
		expect(r.text).toContain("## Baking");
		const h = await svc!.read(join(notes, "page.html"));
		expect(h.text).toContain("# Garden");
		expect(h.text).not.toContain("<h1>");
	});

	it("paginates long files", async () => {
		await writeFile(join(notes, "long.txt"), Array.from({ length: 1000 }, (_, i) => `row ${i + 1}`).join("\n"));
		const r = await svc!.read(join(notes, "long.txt"));
		expect(r.endLine).toBe(400);
		expect(r.truncated).toBe(true);
		expect(r.totalLines).toBe(1000);
		expect((await svc!.read(join(notes, "long.txt"), 401, 5000)).endLine).toBe(800);
		await expect(svc!.read(join(notes, "long.txt"), 5000)).rejects.toThrow(/only 1000 lines/);
	});

	it("refuses anything outside the indexed folders, hidden files, PDFs and binaries", async () => {
		await writeFile(join(base, "outside.md"), "secret");
		await writeFile(join(notes, ".env"), "KEY=1");
		await writeFile(join(notes, "paper.pdf"), "%PDF");
		await writeFile(join(notes, "bin.txt"), Buffer.from([1, 0, 2]));
		for (const p of [
			join(base, "outside.md"),
			join(notes, "..", "outside.md"),
			join(notes, ".env"),
			"/etc/passwd",
			"",
			"a\0b",
		])
			await expect(svc!.read(p), p).rejects.toThrow();
		await expect(svc!.read(join(notes, "paper.pdf"))).rejects.toThrow(/PDFs aren't indexed yet/);
		await expect(svc!.read(join(notes, "bin.txt"))).rejects.toThrow(/isn't text/);
	});

	it("opens documents but only reveals code and data", async () => {
		await writeFile(join(notes, "script.sh"), "echo hi");
		expect((await svc!.openTarget(join(notes, "sourdough.md"))).mode).toBe("open");
		expect((await svc!.openTarget(join(notes, "script.sh"))).mode).toBe("reveal");
		await expect(svc!.openTarget(join(base, "outside.md"))).rejects.toThrow();
	});
});

describe("knowledge tools", () => {
	it("returns formatted passages with sources in details and handles empty states", async () => {
		svc = make();
		await svc.start();
		await svc.addFolder(notes);
		await settle(svc);
		const [search, read] = knowledgeTools({
			search: (q, l) => svc!.search(q, l),
			read: (p, a, b) => svc!.read(p, a, b),
			busy: () => svc!.busy(),
			folderCount: () => svc!.roots().length,
		}) as unknown as Array<{
			name: string;
			execute: (
				id: string,
				p: Record<string, unknown>,
			) => Promise<{ content: Array<{ text: string }>; details: { sources: unknown[] } }>;
		}>;
		expect(search!.name).toBe("knowledge_search");
		const r = await search!.execute("1", { query: "bake bread" });
		expect(r.content[0]!.text).toContain("sourdough.md > Baking (lines 5-7)");
		expect(r.content[0]!.text).toContain(`path: ${join(notes, "sourdough.md")}`);
		expect(r.details.sources[0]).toMatchObject({ name: "sourdough.md", heading: "Baking", startLine: 5, endLine: 7 });
		const rd = await read!.execute("2", { path: join(notes, "sourdough.md"), startLine: 1, endLine: 3 });
		expect(rd.content[0]!.text).toContain("lines 1-3 of 7");
		await expect(read!.execute("3", { path: "/etc/hosts" })).rejects.toThrow(/isn't inside/);

		expect(formatSearch("x", [], false, 0)).toMatch(/No folders/);
		expect(formatSearch("x", [], true, 1)).toMatch(/still running/);
		expect(formatSearch("x", [], false, 1)).toMatch(/No matches/);
	});
});
