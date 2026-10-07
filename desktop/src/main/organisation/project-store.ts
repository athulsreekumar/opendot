// Persistence of organisation projects: <root>/organisation/projects/<id>/project.json (docs/spec/15-organisation.md §2).
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { customAlphabet } from "nanoid";
import writeFileAtomic from "write-file-atomic";
import { ORG_LIMITS, type OrgLogEntry, type OrgProject, type OrgTask } from "../../shared/organisation";
import { log } from "../log";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const gen12 = customAlphabet(alphabet, 12);

/** `prj_` plus letters and digits. Checked before an id is ever used as a path segment. */
export const PROJECT_ID_RE = /^prj_[A-Za-z0-9]{6,40}$/;

export const newProjectId = (): string => `prj_${gen12()}`;
export const isProjectId = (id: unknown): id is string => typeof id === "string" && PROJECT_ID_RE.test(id);

/** What ProjectService needs from storage (a fake in tests). */
export interface ProjectRepo {
	list(): Promise<OrgProject[]>;
	save(p: OrgProject): Promise<void>;
	delete(id: string): Promise<void>;
}

const STATUSES = new Set(["planning", "awaiting-approval", "running", "paused", "done", "failed", "cancelled"]);
const TASK_STATUSES = new Set(["pending", "running", "needs-input", "review", "done", "failed", "skipped"]);

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

function normalizeTask(raw: unknown): OrgTask | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const t = raw as Partial<OrgTask>;
	if (typeof t.id !== "string" || !t.id || typeof t.assignee !== "string") return undefined;
	return {
		...(t as OrgTask),
		id: t.id,
		title: str(t.title),
		brief: str(t.brief),
		assignee: t.assignee as OrgTask["assignee"],
		dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.filter((d): d is string => typeof d === "string") : [],
		status: TASK_STATUSES.has(t.status as string) ? (t.status as OrgTask["status"]) : "pending",
		attempt: Math.max(0, Math.floor(num(t.attempt, 0))),
		reviews: Array.isArray(t.reviews) ? t.reviews : [],
		deliverables: Array.isArray(t.deliverables) ? t.deliverables : [],
	};
}

/** Fills defaults so an old or hand-edited file still loads. Returns undefined when it is not a project. */
export function normalizeProject(raw: unknown, expectedId?: string): OrgProject | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const p = raw as Partial<OrgProject>;
	if (!isProjectId(p.id) || (expectedId !== undefined && p.id !== expectedId)) return undefined;
	const now = new Date().toISOString();
	const tasks = (Array.isArray(p.tasks) ? p.tasks : []).map(normalizeTask).filter((t): t is OrgTask => !!t);
	const logs = (Array.isArray(p.log) ? p.log : []).filter(
		(l): l is OrgLogEntry => !!l && typeof l === "object" && typeof (l as OrgLogEntry).text === "string",
	);
	return {
		...(p as OrgProject),
		id: p.id,
		title: str(p.title, "Untitled project"),
		brief: str(p.brief),
		status: STATUSES.has(p.status as string) ? (p.status as OrgProject["status"]) : "paused",
		createdAt: str(p.createdAt, now),
		updatedAt: str(p.updatedAt, str(p.createdAt, now)),
		tasks,
		concurrency: Math.min(
			ORG_LIMITS.maxConcurrency,
			Math.max(1, Math.floor(num(p.concurrency, ORG_LIMITS.defaultConcurrency))),
		),
		maxRevisions: Math.max(0, Math.floor(num(p.maxRevisions, ORG_LIMITS.defaultMaxRevisions))),
		spentUsd: Math.max(0, num(p.spentUsd, 0)),
		log: logs.slice(-ORG_LIMITS.logMax),
	};
}

export class ProjectStore implements ProjectRepo {
	readonly dir: string;
	private tails = new Map<string, Promise<unknown>>();

	constructor(root: string) {
		this.dir = join(root, "organisation", "projects");
	}

	file(id: string): string {
		if (!isProjectId(id)) throw new Error("Invalid project id.");
		return join(this.dir, id, "project.json");
	}

	async load(id: string): Promise<OrgProject | undefined> {
		if (!isProjectId(id)) return undefined;
		try {
			return normalizeProject(JSON.parse(await readFile(this.file(id), "utf8")), id);
		} catch {
			return undefined;
		}
	}

	/** Every readable project. A corrupt or foreign file is skipped, never fatal. */
	async list(): Promise<OrgProject[]> {
		let names: string[];
		try {
			names = await readdir(this.dir);
		} catch {
			return [];
		}
		const out: OrgProject[] = [];
		for (const name of names) {
			if (!isProjectId(name)) continue;
			const p = await this.load(name);
			if (p) out.push(p);
			else log.warn(`organisation: skipped unreadable project ${name}`);
		}
		return out;
	}

	/** Atomic write; writes for one project are applied in order. */
	save(p: OrgProject): Promise<void> {
		let file: string;
		try {
			file = this.file(p.id);
		} catch (e) {
			return Promise.reject(e);
		}
		const json = `${JSON.stringify(p, null, 2)}\n`;
		const prev = this.tails.get(p.id) ?? Promise.resolve();
		const next = prev
			.catch(() => undefined)
			.then(async () => {
				await mkdir(join(this.dir, p.id), { recursive: true });
				await writeFileAtomic(file, json, { mode: 0o600 });
			});
		this.tails.set(
			p.id,
			next.catch(() => undefined),
		);
		return next;
	}

	async delete(id: string): Promise<void> {
		if (!isProjectId(id)) return;
		await (this.tails.get(id) ?? Promise.resolve());
		await rm(join(this.dir, id), { recursive: true, force: true });
		this.tails.delete(id);
	}
}
