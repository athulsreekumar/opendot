import { describe, expect, it } from "vitest";
import { LIMITS } from "../../shared/defaults";
import { isDotIconKey } from "../../shared/dot-icons";
import { BUILTIN_SKILLS } from "./builtin-skills";
import { domainById, ORG_DOMAINS, ORG_TEMPLATES, personaForDomain, templateById } from "./catalog";

const words = (s: string) => s.trim().split(/\s+/).length;

describe("catalog", () => {
	it("has the 13 domains with unique ids and sensible fields", () => {
		expect(ORG_DOMAINS.map((d) => d.id)).toEqual([
			"engineering",
			"product",
			"design",
			"security",
			"it",
			"data",
			"hr",
			"admin",
			"finance",
			"legal",
			"marketing",
			"sales",
			"support",
		]);
		expect(new Set(ORG_DOMAINS.map((d) => d.id)).size).toBe(13);
		for (const d of ORG_DOMAINS) {
			expect(d.name.length).toBeLessThanOrEqual(LIMITS.nameMax);
			expect(d.tagline.length).toBeLessThanOrEqual(LIMITS.taglineMax);
			expect(isDotIconKey(d.icon), `${d.id} icon ${d.icon}`).toBe(true);
			for (const r of d.reviewedBy) expect(domainById(r), `${d.id} reviewedBy ${r}`).toBeDefined();
		}
		// Colours are as distinct as 12 Dot colours allow: at most one repeat.
		expect(new Set(ORG_DOMAINS.map((d) => d.color)).size).toBeGreaterThanOrEqual(12);
	});

	it("templates only name existing domains", () => {
		expect(ORG_TEMPLATES.map((t) => t.id)).toEqual(["startup", "software-team", "small-business", "full"]);
		for (const t of ORG_TEMPLATES) for (const d of t.domains) expect(domainById(d), `${t.id}/${d}`).toBeDefined();
		expect(templateById("full")!.domains).toHaveLength(13);
		expect(templateById("startup")!.domains).toEqual([
			"engineering",
			"product",
			"design",
			"security",
			"marketing",
			"finance",
			"admin",
		]);
		expect(templateById("nope")).toBeUndefined();
	});

	it("built-in skill ids are unique, prefixed and every domain skill exists", () => {
		const ids = BUILTIN_SKILLS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^builtin:[a-z0-9-]+$/);
		for (const d of ORG_DOMAINS) {
			for (const id of d.skillIds) expect(ids, `${d.id} -> ${id}`).toContain(id);
			expect(BUILTIN_SKILLS.filter((s) => s.domain === d.id).length).toBeGreaterThanOrEqual(2);
			expect(d.skillIds).toContain("builtin:write-status-update");
			expect(d.skillIds).toContain("builtin:break-down-a-request");
		}
	});

	it("every built-in skill is a 120 to 300 word playbook with no em dashes", () => {
		for (const s of BUILTIN_SKILLS) {
			const n = words(s.body);
			expect(n, `${s.id} has ${n} words`).toBeGreaterThanOrEqual(120);
			expect(n, `${s.id} has ${n} words`).toBeLessThanOrEqual(300);
			expect(s.name + s.description + s.body).not.toContain("—");
			expect(s.description.length).toBeLessThanOrEqual(200);
			if (s.domain) expect(s.id.startsWith(`builtin:${s.domain}-`)).toBe(true);
		}
	});

	it("personas carry the task protocol and fit the role limit", () => {
		for (const d of ORG_DOMAINS) {
			const p = personaForDomain(d);
			expect(p.role).toContain("[DONE]");
			expect(p.role).toContain("[BLOCKED]");
			expect(p.role).toContain("[APPROVE]");
			expect(p.role).toContain("[CHANGES]");
			expect(p.role.length).toBeLessThanOrEqual(LIMITS.roleMax * 2);
			expect(p.role).not.toContain("—");
			expect(p.greeting).not.toContain("—");
			const sentences = p.role.split(/(?<=[.!?])\s+/).length;
			expect(sentences).toBeGreaterThanOrEqual(3);
			expect(sentences).toBeLessThanOrEqual(6);
		}
	});
});
