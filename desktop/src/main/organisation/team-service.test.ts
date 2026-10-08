import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { OrgState } from "../../shared/organisation";
import type { Connection } from "../../shared/types";
import type { ConnectionService } from "../connections/connection-service";
import { DotService } from "../dots/dot-service";
import { createPaths, ensureBaseDirs } from "../paths";
import { Store } from "../store/store";
import { ORG_DOMAINS, templateById } from "./catalog";
import { OrgStore } from "./org-store";
import { TeamService } from "./team-service";

const MAC: Connection = {
	id: "con_macmacmacmac",
	type: "mac",
	name: "mac",
	label: "This Mac",
	description: "",
	icon: "laptop",
	enabled: true,
	exposure: "direct",
	toolExposure: {},
	features: ["files", "shell", "calendar"],
	createdAt: "2026-01-01T00:00:00.000Z",
} as unknown as Connection;

async function setup(opts: { withComputer?: boolean } = {}) {
	const root = realpathSync.native(mkdtempSync(join(tmpdir(), "od-team-")));
	const paths = createPaths(root);
	ensureBaseDirs(paths);
	const store = new Store(paths);
	const conns = opts.withComputer === false ? [] : [MAC];
	const connections = {
		list: async () => conns,
		grantFor: async (choice: string) => {
			const [type, feature] = choice.split(":");
			return type === "mac" && conns.length
				? { connectionId: MAC.id, features: feature ? [feature] : undefined }
				: undefined;
		},
	} as unknown as ConnectionService;
	const dots = new DotService(store, paths, connections);
	const broadcast = vi.fn();
	dots.hooks = { broadcast };
	const sup = await dots.ensureSuperBot();
	const emitted: OrgState[] = [];
	const audit = vi.fn();
	const membersChanged = vi.fn();
	const team = new TeamService({
		store: new OrgStore(root),
		dots,
		links: store.links,
		connections,
		skillExists: async (id) => id.startsWith("builtin:") || id === "mine",
		emitState: (s) => emitted.push(s),
		audit,
		membersChanged,
	});
	return { team, dots, store, emitted, broadcast, audit, membersChanged, sup, root };
}

describe("TeamService.setup", () => {
	it("creates one Dot per template domain with roles, persona, skills and grants", async () => {
		const t = await setup();
		const st = await t.team.setup({ templateId: "software-team", name: "Acme" });
		const tpl = templateById("software-team")!;
		expect(st).toMatchObject({ created: true, name: "Acme", templateId: "software-team" });
		expect(st.members.map((m) => m.domain)).toEqual(tpl.domains);
		const dots = await t.dots.list();
		for (const m of st.members) {
			const dot = dots.find((d) => d.id === m.dotId)!;
			const domain = ORG_DOMAINS.find((d) => d.id === m.domain)!;
			expect(dot.name).toBe(domain.name);
			expect(dot.roles).toEqual([m.domain, "org"]);
			expect(dot.appearance).toEqual({ icon: domain.icon, color: domain.color });
			expect(dot.tagline).toBe(domain.tagline);
			expect(dot.persona.role).toContain("[BLOCKED]");
			expect(m.skillIds).toEqual(domain.skillIds);
			const g = dot.grants.find((x) => x.connectionId === MAC.id)!;
			expect(g.features).toEqual(["engineering", "it", "data"].includes(m.domain) ? ["files", "shell"] : ["files"]);
			expect(dot.grants).toHaveLength(1);
		}
		expect(t.emitted.at(-1)).toEqual(st);
		expect(t.broadcast).toHaveBeenCalled();
		expect(t.audit).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(t.audit.mock.calls)).not.toContain("persona");
	});

	it("is idempotent: running it twice (even concurrently) does not duplicate Dots or rules", async () => {
		const t = await setup();
		const [a, b] = await Promise.all([
			t.team.setup({ templateId: "startup" }),
			t.team.setup({ templateId: "startup" }),
		]);
		const again = await t.team.setup({ templateId: "startup" });
		expect(again.members).toHaveLength(7);
		expect(a.members.map((m) => m.dotId)).toEqual(b.members.map((m) => m.dotId));
		expect((await t.dots.list()).filter((d) => d.roles.includes("org"))).toHaveLength(7);
		const rules = (await t.store.links.read()).filter((r) => r.from.kind === "role" && r.from.role === "org");
		expect(rules).toHaveLength(1);
	});

	it("seeds the org to org rule with the right shape and keeps SuperDot's rule", async () => {
		const t = await setup();
		await t.team.setup({ templateId: "startup", domains: ["engineering", "finance"] });
		const rules = await t.store.links.read();
		expect(rules.some((r) => r.from.kind === "super")).toBe(true);
		const r = rules.find((x) => x.from.kind === "role" && x.from.role === "org")!;
		expect(r).toMatchObject({
			to: { kind: "role", role: "org" },
			effect: "allow",
			enabled: true,
			approval: "auto",
			maxPerHour: 30,
			sharePii: false,
			purpose: "Organisation teamwork",
		});
	});

	it("only creates the chosen domains and a later template adds the missing ones", async () => {
		const t = await setup();
		const first = await t.team.setup({ templateId: "startup", domains: ["engineering", "design"] });
		expect(first.members.map((m) => m.domain)).toEqual(["engineering", "design"]);
		const more = await t.team.setup({ templateId: "startup" });
		expect(more.members).toHaveLength(7);
		expect(more.members.slice(0, 2)).toEqual(first.members);
	});

	it("grants nothing when the built-in computer connection does not exist", async () => {
		const t = await setup({ withComputer: false });
		const st = await t.team.setup({ templateId: "startup", domains: ["engineering"] });
		const dot = await t.dots.get(st.members[0]!.dotId);
		expect(dot.grants).toEqual([]);
		expect(dot.suggestedConnections).toEqual([]);
	});

	it("rejects unknown templates and domains", async () => {
		const t = await setup();
		await expect(t.team.setup({ templateId: "nope" })).rejects.toMatchObject({ code: "INVALID_ARGS" });
		await expect(t.team.setup({ templateId: "full", domains: ["wizardry"] })).rejects.toMatchObject({
			code: "INVALID_ARGS",
		});
		await expect(t.team.setup({ templateId: "full", domains: [] })).rejects.toMatchObject({ code: "INVALID_ARGS" });
	});
});

describe("TeamService members", () => {
	it("addMember creates a Dot once per domain", async () => {
		const t = await setup();
		const m = await t.team.addMember({ domain: "legal" });
		expect(m.domain).toBe("legal");
		expect((await t.team.addMember({ domain: "legal" })).dotId).toBe(m.dotId);
		expect((await t.team.state()).members).toHaveLength(1);
		await expect(t.team.addMember({ domain: "zzz" })).rejects.toMatchObject({ code: "INVALID_ARGS" });
	});

	it("addMember adopts an existing Dot, keeping everything else", async () => {
		const t = await setup();
		const dot = await t.dots.create({
			draft: {
				name: "Accounts",
				tagline: "mine",
				appearance: { icon: "receipt", color: "amber" },
				persona: { ...(await t.dots.ensureSuperBot()).persona, role: "Custom role" },
				suggestedConnections: [],
				roles: ["assistant"],
			},
		});
		const m = await t.team.addMember({ domain: "finance", dotId: dot.id });
		const after = await t.dots.get(dot.id);
		expect(m.dotId).toBe(dot.id);
		expect(after.roles).toEqual(["assistant", "finance", "org"]);
		expect(after.name).toBe("Accounts");
		expect(after.persona.role).toBe("Custom role");
		await expect(t.team.addMember({ domain: "hr", dotId: dot.id })).rejects.toMatchObject({ code: "INVALID_ARGS" });
		await expect(t.team.addMember({ domain: "hr", dotId: t.sup.id })).rejects.toMatchObject({ code: "INVALID_ARGS" });
	});

	it("removeMember keeps the Dot but drops the organisation roles", async () => {
		const t = await setup();
		const { members } = await t.team.setup({ templateId: "startup", domains: ["engineering", "design"] });
		await t.team.removeMember(members[0]!.dotId);
		const dot = await t.dots.get(members[0]!.dotId);
		expect(dot.roles).toEqual([]);
		expect((await t.team.state()).members.map((m) => m.domain)).toEqual(["design"]);
		await t.team.removeMember(members[0]!.dotId); // no-op the second time
		expect(t.membersChanged).toHaveBeenCalledWith([members[0]!.dotId]);
	});

	it("setMemberSkills stores the list, dedupes, and rejects unknown skills and non-members", async () => {
		const t = await setup();
		const { members } = await t.team.setup({ templateId: "startup", domains: ["engineering"] });
		const id = members[0]!.dotId;
		await t.team.setMemberSkills(id, ["mine", "builtin:write-status-update", "mine"]);
		expect((await t.team.state()).members[0]!.skillIds).toEqual(["mine", "builtin:write-status-update"]);
		await expect(t.team.setMemberSkills(id, ["ghost"])).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(t.team.setMemberSkills("dot_zzzzzzzzzz", [])).rejects.toMatchObject({ code: "NOT_FOUND" });
		await t.team.dropSkill("mine");
		expect((await t.team.state()).members[0]!.skillIds).toEqual(["builtin:write-status-update"]);
	});

	it("state() drops members whose Dot was deleted", async () => {
		const t = await setup();
		const { members } = await t.team.setup({ templateId: "startup", domains: ["engineering", "design"] });
		await t.dots.remove(members[0]!.dotId);
		expect((await t.team.state()).members.map((m) => m.domain)).toEqual(["design"]);
	});
});
