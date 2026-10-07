// The organisation's team: set up from a template, add and remove members, choose their skills (spec 15 §3).
// Members are ordinary Dots (roles [domain, "org"]); the team list lives in organisation/org.json via OrgStore.
import { OpenDotError } from "../../shared/errors";
import { newId } from "../../shared/ids";
import type { OrgDomain, OrgMember, OrgState } from "../../shared/organisation";
import type { Connection, CreateDotInput, Dot, DotId, DotLink, DotPatch } from "../../shared/types";
import { log } from "../log";
import { domainById, personaForDomain, templateById } from "./catalog";
import type { OrgStore } from "./org-store";

export const ORG_ROLE = "org";
const MAX_MEMBER_SKILLS = 40;
const DEFAULT_NAME = "My organisation";

export interface TeamDeps {
	store: OrgStore;
	dots: {
		create(input: CreateDotInput): Promise<Dot>;
		update(id: DotId, patch: DotPatch): Promise<Dot>;
		get(id: DotId): Promise<Dot>;
		list(): Promise<Dot[]>;
	};
	links: { update(fn: (cur: DotLink[]) => DotLink[] | Promise<DotLink[]>): Promise<unknown> };
	connections: { list(): Promise<Connection[]> };
	/** Whether a skill id exists (built-in or the user's). */
	skillExists(id: string): Promise<boolean>;
	emitState(state: OrgState): void;
	/** Audit entry without any contents (counts and names of domains only). */
	audit?(summary: string, data: Record<string, string | number | boolean | null>): void;
	/** Called after a member's skills or membership changed (so a running session can pick the change up). */
	membersChanged?(dotIds: DotId[]): void;
}

/** Domains whose Dot gets shell access on the built-in computer connection, next to files. */
const SHELL_DOMAINS: ReadonlySet<string> = new Set(["engineering", "it", "data"]);

export class TeamService {
	private chain: Promise<unknown> = Promise.resolve();
	constructor(private readonly d: TeamDeps) {}

	/** The team file; share this instance (it caches) instead of creating another OrgStore. */
	get store(): OrgStore {
		return this.d.store;
	}

	/** Runs one change at a time so two quick calls can never create the same domain twice. */
	private serial<T>(fn: () => Promise<T>): Promise<T> {
		const run = this.chain.then(fn, fn);
		this.chain = run.catch(() => undefined);
		return run;
	}

	/** The current team. Members whose Dot was deleted are dropped. */
	async state(): Promise<OrgState> {
		return this.serial(() => this.readPruned());
	}

	private async readPruned(): Promise<OrgState> {
		const st = await this.d.store.read();
		if (st.members.length === 0) return st;
		const ids = new Set((await this.d.dots.list()).map((x) => x.id));
		const kept = st.members.filter((m) => ids.has(m.dotId));
		if (kept.length === st.members.length) return st;
		const next = { ...st, members: kept };
		await this.d.store.write(next);
		return next;
	}

	async setup(input: { templateId: string; name?: string; domains?: string[] }): Promise<OrgState> {
		const template = templateById(input.templateId);
		if (!template) throw new OpenDotError("INVALID_ARGS", "That team template does not exist.");
		const wanted = [...new Set(input.domains ?? template.domains)];
		for (const id of wanted)
			if (!domainById(id)) throw new OpenDotError("INVALID_ARGS", `"${id}" is not a known domain.`);
		if (wanted.length === 0) throw new OpenDotError("INVALID_ARGS", "Choose at least one domain.");
		return this.serial(async () => {
			let st = await this.readPruned();
			const name = input.name?.trim().slice(0, 60);
			st = {
				...st,
				created: true,
				name: name || st.name || DEFAULT_NAME,
				templateId: st.templateId ?? template.id,
			};
			await this.d.store.write(st);
			let made = 0;
			for (const id of wanted) {
				if (st.members.some((m) => m.domain === id)) continue;
				const domain = domainById(id)!;
				const dot = await this.createDomainDot(domain);
				st = { ...st, members: [...st.members, { dotId: dot.id, domain: id, skillIds: [...domain.skillIds] }] };
				await this.d.store.write(st); // after each Dot, so a failure half way never loses members
				made++;
			}
			await this.seedRule();
			this.d.audit?.(`Set up the organisation (${made} new Dot${made === 1 ? "" : "s"})`, {
				template: template.id,
				created: made,
				members: st.members.length,
			});
			this.d.emitState(st);
			return st;
		});
	}

	async addMember(input: { domain: string; dotId?: DotId }): Promise<OrgMember> {
		const domain = domainById(input.domain);
		if (!domain) throw new OpenDotError("INVALID_ARGS", "That domain does not exist.");
		return this.serial(async () => {
			let st = await this.readPruned();
			let member: OrgMember;
			if (input.dotId) {
				const prior = st.members.find((m) => m.dotId === input.dotId);
				if (prior) {
					if (prior.domain === domain.id) return prior;
					throw new OpenDotError("INVALID_ARGS", "This Dot is already on the team in another domain.");
				}
				const dot = await this.d.dots.get(input.dotId);
				if (dot.kind === "super")
					throw new OpenDotError("INVALID_ARGS", "SuperDot leads the team and can't be a member.");
				// Keep the Dot's own roles (up to 6) and always end with ours.
				const own = dot.roles.filter((r) => r !== domain.id && r !== ORG_ROLE).slice(0, 6);
				const roles = [...own, domain.id, ORG_ROLE];
				await this.d.dots.update(dot.id, { roles });
				member = { dotId: dot.id, domain: domain.id, skillIds: [...domain.skillIds] };
			} else {
				const existing = st.members.find((m) => m.domain === domain.id);
				if (existing) return existing;
				const dot = await this.createDomainDot(domain);
				member = { dotId: dot.id, domain: domain.id, skillIds: [...domain.skillIds] };
			}
			st = { ...st, created: true, name: st.name || DEFAULT_NAME, members: [...st.members, member] };
			await this.d.store.write(st);
			await this.seedRule();
			this.d.audit?.(`Added ${domain.name} to the organisation`, { domain: domain.id, adopted: !!input.dotId });
			this.d.emitState(st);
			return member;
		});
	}

	/** Takes the Dot out of the organisation. The Dot itself is kept, minus the organisation roles. */
	async removeMember(dotId: DotId): Promise<void> {
		return this.serial(async () => {
			const st = await this.d.store.read();
			const member = st.members.find((m) => m.dotId === dotId);
			if (!member) return;
			const next = { ...st, members: st.members.filter((m) => m.dotId !== dotId) };
			await this.d.store.write(next);
			try {
				const dot = await this.d.dots.get(dotId);
				const roles = dot.roles.filter((r) => r !== member.domain && r !== ORG_ROLE);
				if (roles.length !== dot.roles.length) await this.d.dots.update(dotId, { roles });
			} catch (e) {
				// The Dot is already gone; nothing to tidy.
				if (!(e instanceof OpenDotError && e.code === "NOT_FOUND")) log.warn("removing organisation roles failed", e);
			}
			this.d.audit?.("Removed a Dot from the organisation", { domain: member.domain });
			this.d.membersChanged?.([dotId]);
			this.d.emitState(next);
		});
	}

	async setMemberSkills(dotId: DotId, skillIds: string[]): Promise<void> {
		const ids = [...new Set(skillIds)];
		if (ids.length > MAX_MEMBER_SKILLS)
			throw new OpenDotError("LIMIT", `A member can have up to ${MAX_MEMBER_SKILLS} skills.`);
		return this.serial(async () => {
			const st = await this.d.store.read();
			if (!st.members.some((m) => m.dotId === dotId))
				throw new OpenDotError("NOT_FOUND", "This Dot is not on the team.");
			for (const id of ids)
				if (!(await this.d.skillExists(id))) throw new OpenDotError("NOT_FOUND", "One of the skills no longer exists.");
			const next = { ...st, members: st.members.map((m) => (m.dotId === dotId ? { ...m, skillIds: ids } : m)) };
			await this.d.store.write(next);
			this.d.membersChanged?.([dotId]);
			this.d.emitState(next);
		});
	}

	/** Used when a user skill is deleted: removes the id from every member. */
	async dropSkill(skillId: string): Promise<void> {
		return this.serial(async () => {
			const st = await this.d.store.read();
			const touched = st.members.filter((m) => m.skillIds.includes(skillId));
			if (touched.length === 0) return;
			const next = {
				...st,
				members: st.members.map((m) => ({ ...m, skillIds: m.skillIds.filter((s) => s !== skillId) })),
			};
			await this.d.store.write(next);
			this.d.membersChanged?.(touched.map((m) => m.dotId));
			this.d.emitState(next);
		});
	}

	private async createDomainDot(domain: OrgDomain): Promise<Dot> {
		const conns = await this.d.connections.list();
		// The built-in computer connection (This Mac / This PC) only when it exists.
		const hasComputer = conns.some((c) => c.type === "mac");
		const suggested = hasComputer ? ["mac:files", ...(SHELL_DOMAINS.has(domain.id) ? ["mac:shell"] : [])] : [];
		return this.d.dots.create({
			draft: {
				name: domain.name,
				tagline: domain.tagline,
				appearance: { emoji: domain.emoji, color: domain.color },
				persona: personaForDomain(domain),
				suggestedConnections: suggested,
				roles: [domain.id, ORG_ROLE],
			},
		});
	}

	/** One rule: org Dots may message each other without asking. Created only if no such rule exists. */
	private async seedRule(): Promise<void> {
		await this.d.links.update((rules) => {
			const has = rules.some(
				(r) =>
					r.from.kind === "role" &&
					r.from.role === ORG_ROLE &&
					r.to.kind === "role" &&
					r.to.role === ORG_ROLE &&
					r.effect === "allow",
			);
			if (has) return rules;
			return [
				...rules,
				{
					id: newId("lnk"),
					from: { kind: "role", role: ORG_ROLE },
					to: { kind: "role", role: ORG_ROLE },
					effect: "allow",
					enabled: true,
					approval: "auto",
					maxPerHour: 30,
					sharePii: false,
					purpose: "Organisation teamwork",
					createdAt: new Date().toISOString(),
				},
			];
		});
	}
}
