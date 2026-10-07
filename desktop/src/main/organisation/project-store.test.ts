import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OrgProject } from "../../shared/organisation";
import { isProjectId, newProjectId, normalizeProject, ProjectStore } from "./project-store";

let root: string;
beforeEach(() => {
	root = realpathSync(mkdtempSync(join(tmpdir(), "opendot-pstore-")));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const sample = (id: string): OrgProject => ({
	id,
	title: "Add SSO",
	brief: "Single sign-on for customers",
	status: "running",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:05:00.000Z",
	tasks: [
		{
			id: "t1",
			title: "Build",
			brief: "Do it",
			assignee: "dot_engineer1",
			dependsOn: [],
			reviewer: "human",
			status: "review",
			attempt: 2,
			result: "done",
			reviews: [{ verdict: "changes", note: "tests", by: "dot_security1", at: "2026-01-01T00:03:00.000Z" }],
			deliverables: [{ kind: "file", title: "a.md", path: "projects/x/t1/a.md" }],
		},
	],
	plannerNote: "Because.",
	concurrency: 2,
	maxRevisions: 3,
	budgetUsd: 5,
	spentUsd: 1.25,
	statusNote: "note",
	log: [{ at: "2026-01-01T00:01:00.000Z", kind: "task", taskId: "t1", text: "Started" }],
});

describe("ProjectStore", () => {
	it("round-trips a project through <root>/organisation/projects/<id>/project.json", async () => {
		const store = new ProjectStore(root);
		const id = newProjectId();
		expect(id).toMatch(/^prj_[A-Za-z0-9]{12}$/);
		await store.save(sample(id));
		expect(store.file(id)).toBe(join(root, "organisation", "projects", id, "project.json"));
		expect(await store.load(id)).toEqual(sample(id));
		expect(await store.list()).toEqual([sample(id)]);
		await store.delete(id);
		expect(await store.list()).toEqual([]);
	});

	it("applies saves in order", async () => {
		const store = new ProjectStore(root);
		const id = newProjectId();
		const saves = [1, 2, 3, 4, 5].map((n) => store.save({ ...sample(id), spentUsd: n }));
		await Promise.all(saves);
		expect((await store.load(id))?.spentUsd).toBe(5);
	});

	it("skips corrupt, foreign and mismatched files", async () => {
		const store = new ProjectStore(root);
		const good = newProjectId();
		await store.save(sample(good));
		const dir = join(root, "organisation", "projects");
		mkdirSync(join(dir, "prj_corrupt0001"), { recursive: true });
		writeFileSync(join(dir, "prj_corrupt0001", "project.json"), "{ not json");
		mkdirSync(join(dir, "prj_mismatch001"), { recursive: true });
		writeFileSync(join(dir, "prj_mismatch001", "project.json"), JSON.stringify(sample("prj_someoneelse1")));
		mkdirSync(join(dir, "not-a-project"), { recursive: true });
		writeFileSync(join(dir, "stray.txt"), "x");
		expect((await store.list()).map((p) => p.id)).toEqual([good]);
	});

	it("never uses an unvalidated id as a path", async () => {
		const store = new ProjectStore(root);
		for (const bad of ["../x", "prj_../x", "prj_", "", "dot_abcdef123456", "prj_a/b", "prj_a\\b"]) {
			expect(isProjectId(bad)).toBe(false);
			expect(await store.load(bad)).toBeUndefined();
			expect(() => store.file(bad)).toThrow();
			await store.delete(bad);
		}
		await expect(store.save({ ...sample("prj_abcdef123456"), id: "../evil" })).rejects.toThrow();
	});

	it("fills defaults for a sparse or old file", () => {
		const p = normalizeProject({
			id: "prj_abcdef123456",
			title: "T",
			tasks: [{ id: "t1", assignee: "human" }, 5, null],
			status: "weird",
		});
		expect(p).toMatchObject({
			id: "prj_abcdef123456",
			title: "T",
			status: "paused",
			concurrency: 3,
			maxRevisions: 2,
			spentUsd: 0,
			log: [],
		});
		expect(p?.tasks).toEqual([
			{
				id: "t1",
				title: "",
				brief: "",
				assignee: "human",
				dependsOn: [],
				status: "pending",
				attempt: 0,
				reviews: [],
				deliverables: [],
			},
		]);
		expect(normalizeProject({ title: "no id" })).toBeUndefined();
		expect(normalizeProject("x")).toBeUndefined();
	});
});
