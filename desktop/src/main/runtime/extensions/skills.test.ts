import { describe, expect, it } from "vitest";
import type { OrgMember, Skill } from "../../../shared/organisation";
import { SKILLS_NOTE, skillsExtension } from "./skills";

const skill = (id: string, name: string, body = `${name} body`): Skill => ({
	id,
	name,
	description: `${name} description`,
	builtin: false,
	body,
	updatedAt: "2026-01-01T00:00:00.000Z",
});

const SKILLS = [skill("a", "Ship a change"), skill("b", "Review code")];

function setup(member: OrgMember | undefined) {
	const handlers = new Map<string, (e: unknown) => Promise<void>>();
	const tools = new Map<
		string,
		{
			execute: (id: string, p: { name: string }) => Promise<{ content: { text: string }[] }>;
			annotations?: { readOnlyHint?: boolean };
		}
	>();
	let current = member;
	const ext = skillsExtension({
		member: async () => current,
		skill: async (id) => SKILLS.find((s) => s.id === id),
	});
	(ext as { factory: (api: never) => void }).factory({
		on: (n: string, h: (e: unknown) => Promise<void>) => handlers.set(n, h),
		registerTool: (t: never) => tools.set((t as { name: string }).name, t),
	} as never);
	const sections: Record<string, string> = {};
	const turn = () => handlers.get("before_agent_start")!({ systemPromptOptions: { sections } });
	return { tools, sections, turn, set: (m: OrgMember | undefined) => (current = m) };
}

const member = (skillIds: string[]): OrgMember => ({ dotId: "dot_aaaaaaaa", domain: "engineering", skillIds });

describe("skills extension", () => {
	it("adds a section with name and description, never the body", async () => {
		const t = setup(member(["a", "b"]));
		await t.turn();
		expect(t.sections.skills).toContain("- Ship a change: Ship a change description");
		expect(t.sections.skills).toContain("- Review code: Review code description");
		expect(t.sections.skills).not.toContain("body");
		expect(t.tools.get("use_skill")?.annotations?.readOnlyHint).toBe(true);
	});

	it("use_skill returns the body with the organisation note, by name or id", async () => {
		const t = setup(member(["a"]));
		const r = await t.tools.get("use_skill")!.execute("1", { name: "ship a CHANGE" });
		expect(r.content[0]!.text).toContain(SKILLS_NOTE);
		expect(r.content[0]!.text).toContain("Ship a change body");
		expect((await t.tools.get("use_skill")!.execute("2", { name: "a" })).content[0]!.text).toContain(
			"Ship a change body",
		);
	});

	it("only offers the member's own skills and explains an unknown name", async () => {
		const t = setup(member(["a"]));
		await expect(t.tools.get("use_skill")!.execute("1", { name: "Review code" })).rejects.toThrow(
			/Your skills: Ship a change/,
		);
	});

	it("is rebuilt each turn: edits and removals apply, and a Dot with no skills gets no section", async () => {
		const t = setup(member(["a"]));
		await t.turn();
		expect(t.sections.skills).toContain("Ship a change");
		t.set(member(["a", "b"]));
		await t.turn();
		expect(t.sections.skills).toContain("Review code");
		t.set(member([]));
		await t.turn();
		expect(t.sections.skills).toBeUndefined();
		t.set(undefined);
		await t.turn();
		expect(t.sections.skills).toBeUndefined();
		await expect(t.tools.get("use_skill")!.execute("1", { name: "a" })).rejects.toThrow(/no skills/);
	});

	it("skips a skill that no longer exists", async () => {
		const t = setup(member(["gone", "b"]));
		await t.turn();
		expect(t.sections.skills).toContain("Review code");
		expect(t.sections.skills).not.toContain("gone");
	});
});
