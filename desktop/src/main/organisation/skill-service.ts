// Skills: built-in playbooks (read-only, bundled) and the user's own, stored as markdown files with
// frontmatter under <root>/organisation/skills/<id>.md (spec 15 §4).
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { OpenDotError } from "../../shared/errors";
import type { Skill, SkillInput, SkillSummary } from "../../shared/organisation";
import { log } from "../log";
import { BUILTIN_SKILLS, builtinSkillById } from "./builtin-skills";

export const SKILL_LIMITS = { nameMax: 80, descriptionMax: 200, bodyMax: 20_000, domainMax: 40 } as const;

const USER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Names Windows will not accept as a file name, with or without an extension.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;

/** A safe, lower-case id for a user skill file ("My Skill!" becomes "my-skill"). Also safe on Windows. */
export function sanitizeSkillId(name: string): string {
	let id = name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48)
		.replace(/-+$/g, "");
	if (!id) id = "skill";
	if (WINDOWS_RESERVED.test(id)) id = `${id}-skill`;
	return id;
}

export interface SkillServiceOptions {
	/** The OpenDot data root (e.g. ~/.opendot). */
	root: string;
	/** Called with the new list after every change (broadcast `org:skills`). */
	emit?: (skills: SkillSummary[]) => void;
	/** Called when a user skill is deleted, so members can drop it. */
	onDeleted?: (id: string) => Promise<void>;
}

export class SkillService {
	readonly dir: string;
	constructor(private readonly opts: SkillServiceOptions) {
		this.dir = join(opts.root, "organisation", "skills");
	}

	async list(): Promise<SkillSummary[]> {
		const builtins: SkillSummary[] = BUILTIN_SKILLS.map((s) => ({
			id: s.id,
			name: s.name,
			description: s.description,
			...(s.domain ? { domain: s.domain } : {}),
			builtin: true,
		}));
		const users = (await this.readUserSkills()).map(({ body: _b, updatedAt: _u, ...summary }) => summary);
		users.sort((a, b) => a.name.localeCompare(b.name));
		return [...builtins, ...users];
	}

	async get(id: string): Promise<Skill> {
		const b = builtinSkillById(id);
		if (b)
			return {
				id: b.id,
				name: b.name,
				description: b.description,
				...(b.domain ? { domain: b.domain } : {}),
				builtin: true,
				body: b.body,
				updatedAt: new Date(0).toISOString(),
			};
		const s = USER_ID.test(id) ? await this.readOne(id) : undefined;
		if (!s) throw new OpenDotError("NOT_FOUND", "This skill no longer exists.");
		return s;
	}

	/** Finds a skill by id or, for the model, by name (case-insensitive). */
	async find(idOrName: string): Promise<Skill | undefined> {
		try {
			return await this.get(idOrName);
		} catch {
			const q = idOrName.trim().toLowerCase();
			const hit = (await this.list()).find((s) => s.name.toLowerCase() === q);
			return hit ? this.get(hit.id) : undefined;
		}
	}

	async save(input: SkillInput): Promise<Skill> {
		const name = input.name.trim();
		const description = input.description.replace(/\s+/g, " ").trim();
		const domain = input.domain?.trim() || undefined;
		if (!name) throw new OpenDotError("INVALID_ARGS", "Give the skill a name.");
		if (name.length > SKILL_LIMITS.nameMax)
			throw new OpenDotError("INVALID_ARGS", `The name can be up to ${SKILL_LIMITS.nameMax} characters.`);
		if (description.length > SKILL_LIMITS.descriptionMax)
			throw new OpenDotError("INVALID_ARGS", `The description can be up to ${SKILL_LIMITS.descriptionMax} characters.`);
		if (input.body.length > SKILL_LIMITS.bodyMax)
			throw new OpenDotError("TOO_LARGE", `The skill text can be up to ${SKILL_LIMITS.bodyMax} characters.`);
		if (domain && (domain.length > SKILL_LIMITS.domainMax || /[\r\n]/.test(domain)))
			throw new OpenDotError("INVALID_ARGS", "That domain is not valid.");

		let id: string;
		if (input.id && !builtinSkillById(input.id)) {
			if (!USER_ID.test(input.id) || !(await this.readOne(input.id)))
				throw new OpenDotError("NOT_FOUND", "This skill no longer exists.");
			id = input.id;
		} else {
			// New skill, or a copy of a built-in: a fresh id that never overwrites another skill.
			id = await this.freshId(sanitizeSkillId(name));
		}
		const skill: Skill = {
			id,
			name,
			description,
			...(domain ? { domain } : {}),
			builtin: false,
			body: input.body,
			updatedAt: new Date().toISOString(),
		};
		await mkdir(this.dir, { recursive: true });
		await writeFileAtomic(join(this.dir, `${id}.md`), serializeSkill(skill), { mode: 0o600 });
		await this.emitList();
		return skill;
	}

	async delete(id: string): Promise<void> {
		if (builtinSkillById(id))
			throw new OpenDotError("BUILTIN", "Built-in skills can't be deleted. Duplicate one to change it.");
		if (!USER_ID.test(id) || !(await this.readOne(id)))
			throw new OpenDotError("NOT_FOUND", "This skill no longer exists.");
		await rm(join(this.dir, `${id}.md`), { force: true });
		await this.opts.onDeleted?.(id).catch((e) => log.warn("removing a deleted skill from members failed", e));
		await this.emitList();
	}

	/** Whether the id names a skill that exists (built-in or user). */
	async exists(id: string): Promise<boolean> {
		if (builtinSkillById(id)) return true;
		return USER_ID.test(id) && (await this.readOne(id)) !== undefined;
	}

	private async emitList(): Promise<void> {
		if (!this.opts.emit) return;
		try {
			this.opts.emit(await this.list());
		} catch (e) {
			log.warn("skills emit failed", e);
		}
	}

	private async freshId(base: string): Promise<string> {
		const taken = new Set((await this.readUserSkills()).map((s) => s.id));
		if (!taken.has(base)) return base;
		for (let i = 2; ; i++) {
			const id = `${base.slice(0, 56)}-${i}`;
			if (!taken.has(id)) return id;
		}
	}

	private async readUserSkills(): Promise<Skill[]> {
		let files: string[];
		try {
			files = await readdir(this.dir);
		} catch {
			return [];
		}
		const out: Skill[] = [];
		for (const f of files) {
			if (!f.endsWith(".md")) continue;
			const id = f.slice(0, -3);
			if (!USER_ID.test(id)) continue;
			const s = await this.readOne(id);
			if (s) out.push(s);
		}
		return out;
	}

	private async readOne(id: string): Promise<Skill | undefined> {
		try {
			return parseSkill(id, await readFile(join(this.dir, `${id}.md`), "utf8"));
		} catch {
			return undefined;
		}
	}
}

// ───────────────────────── Frontmatter ─────────────────────────

const q = (s: string) => JSON.stringify(s);

export function serializeSkill(s: Pick<Skill, "name" | "description" | "domain" | "body" | "updatedAt">): string {
	const lines = ["---", `name: ${q(s.name)}`, `description: ${q(s.description)}`];
	if (s.domain) lines.push(`domain: ${q(s.domain)}`);
	lines.push(`updatedAt: ${q(s.updatedAt)}`, "---", "");
	return `${lines.join("\n")}\n${s.body.replace(/\s+$/, "")}\n`;
}

function unq(v: string): string {
	const t = v.trim();
	if (t.startsWith('"')) {
		try {
			const x: unknown = JSON.parse(t);
			if (typeof x === "string") return x;
		} catch {
			/* fall through to the raw text */
		}
	}
	return t.replace(/^'(.*)'$/, "$1");
}

/** Parses a skill file. Tolerant: a file without frontmatter becomes a skill named after its id. */
export function parseSkill(id: string, text: string): Skill {
	const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
	const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);
	const meta: Record<string, string> = {};
	let body = src;
	if (m) {
		for (const line of m[1]!.split("\n")) {
			const i = line.indexOf(":");
			if (i > 0) meta[line.slice(0, i).trim()] = unq(line.slice(i + 1));
		}
		body = m[2]!;
	}
	return {
		id,
		name: (meta.name || id).slice(0, SKILL_LIMITS.nameMax),
		description: (meta.description ?? "").slice(0, SKILL_LIMITS.descriptionMax),
		...(meta.domain ? { domain: meta.domain.slice(0, SKILL_LIMITS.domainMax) } : {}),
		builtin: false,
		body: body.replace(/^\n+/, "").replace(/\s+$/, ""),
		updatedAt: meta.updatedAt || new Date(0).toISOString(),
	};
}
