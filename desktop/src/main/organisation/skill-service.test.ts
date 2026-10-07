import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillSummary } from "../../shared/organisation";
import { parseSkill, SkillService, sanitizeSkillId, serializeSkill } from "./skill-service";

let root: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "org-skills-"));
});
afterEach(() => rm(root, { recursive: true, force: true }));

const input = {
	name: "How we ship",
	description: "Our release steps.",
	domain: "engineering",
	body: "1. Test\n2. Ship",
};

describe("SkillService", () => {
	it("lists built-ins and user skills, and gets one", async () => {
		const emit = vi.fn();
		const svc = new SkillService({ root, emit });
		const saved = await svc.save(input);
		expect(saved.id).toBe("how-we-ship");
		expect(saved.builtin).toBe(false);
		const list = await svc.list();
		expect(list.some((s) => s.id === "builtin:engineering-ship-a-change" && s.builtin)).toBe(true);
		expect(list.find((s) => s.id === "how-we-ship")).toMatchObject({
			name: "How we ship",
			domain: "engineering",
			builtin: false,
		});
		expect(list.find((s) => s.id === "how-we-ship")).not.toHaveProperty("body");
		expect((await svc.get("how-we-ship")).body).toBe("1. Test\n2. Ship");
		expect((await svc.get("builtin:engineering-ship-a-change")).builtin).toBe(true);
		expect(emit).toHaveBeenCalledTimes(1);
		expect((emit.mock.calls[0]![0] as SkillSummary[]).some((s) => s.id === "how-we-ship")).toBe(true);
	});

	it("round-trips frontmatter, including quotes, colons and unusual text", () => {
		const s = {
			name: 'Say "hi": now',
			description: "Line with: colon and --- dashes",
			domain: "hr",
			body: "---\nnot frontmatter\n---\n# Heading\ntext",
			updatedAt: "2026-01-01T00:00:00.000Z",
		};
		const back = parseSkill("x", serializeSkill(s));
		expect(back).toMatchObject({
			name: s.name,
			description: s.description,
			domain: "hr",
			body: s.body,
			updatedAt: s.updatedAt,
		});
		expect(parseSkill("plain", "just text\r\nmore").name).toBe("plain");
	});

	it("saves atomically as a markdown file and updates in place", async () => {
		const svc = new SkillService({ root });
		const a = await svc.save(input);
		const b = await svc.save({ ...input, id: a.id, body: "changed" });
		expect(b.id).toBe(a.id);
		expect((await svc.get(a.id)).body).toBe("changed");
		const files = await readdir(join(root, "organisation", "skills"));
		expect(files).toEqual(["how-we-ship.md"]);
		expect(await readFile(join(root, "organisation", "skills", "how-we-ship.md"), "utf8")).toMatch(
			/^---\nname: "How we ship"/,
		);
	});

	it("never overwrites another skill when names collide", async () => {
		const svc = new SkillService({ root });
		const a = await svc.save(input);
		const b = await svc.save(input);
		expect(b.id).toBe(`${a.id}-2`);
	});

	it("editing a built-in creates a copy with a new id and leaves the built-in alone", async () => {
		const svc = new SkillService({ root });
		const orig = await svc.get("builtin:engineering-ship-a-change");
		const copy = await svc.save({ ...orig, name: "Ship a change (ours)", body: "Our way" });
		expect(copy.id).not.toBe(orig.id);
		expect(copy.builtin).toBe(false);
		expect((await svc.get(orig.id)).body).toBe(orig.body);
		expect((await svc.get(copy.id)).body).toBe("Our way");
	});

	it("refuses to delete built-ins and removes user skills from members via the callback", async () => {
		const onDeleted = vi.fn(async () => undefined);
		const emit = vi.fn();
		const svc = new SkillService({ root, onDeleted, emit });
		await expect(svc.delete("builtin:write-status-update")).rejects.toMatchObject({ code: "BUILTIN" });
		const s = await svc.save(input);
		emit.mockClear();
		await svc.delete(s.id);
		expect(onDeleted).toHaveBeenCalledWith(s.id);
		expect(emit).toHaveBeenCalledTimes(1);
		await expect(svc.get(s.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(svc.delete(s.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("validates input and rejects path tricks as ids", async () => {
		const svc = new SkillService({ root });
		await expect(svc.save({ ...input, name: "  " })).rejects.toMatchObject({ code: "INVALID_ARGS" });
		await expect(svc.save({ ...input, body: "x".repeat(20_001) })).rejects.toMatchObject({ code: "TOO_LARGE" });
		await expect(svc.save({ ...input, id: "../evil" })).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(svc.get("../../etc/passwd")).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(svc.delete("..\\evil")).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("sanitises ids for every platform, including Windows reserved names", () => {
		expect(sanitizeSkillId("My Skill: v2?")).toBe("my-skill-v2");
		expect(sanitizeSkillId("Café résumé")).toBe("cafe-resume");
		expect(sanitizeSkillId("???")).toBe("skill");
		expect(sanitizeSkillId("CON")).toBe("con-skill");
		expect(sanitizeSkillId("lpt1")).toBe("lpt1-skill");
		expect(sanitizeSkillId("a".repeat(200)).length).toBeLessThanOrEqual(48);
		expect(sanitizeSkillId("a/b\\c.md")).toBe("a-b-c-md");
	});

	it("ignores stray files in the folder and finds skills by name", async () => {
		const svc = new SkillService({ root });
		await svc.save(input);
		await writeFile(join(root, "organisation", "skills", "Bad Name!.md"), "x");
		await writeFile(join(root, "organisation", "skills", "notes.txt"), "x");
		expect((await svc.list()).filter((s) => !s.builtin)).toHaveLength(1);
		expect((await svc.find("how we ship"))?.id).toBe("how-we-ship");
		expect(await svc.find("nothing")).toBeUndefined();
	});
});
