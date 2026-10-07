// Test fixtures for the Organisation screens (not shipped logic).
import type {
	OrgDomain,
	OrgMember,
	OrgProject,
	OrgState,
	OrgTask,
	OrgTemplate,
	SkillSummary,
} from "@shared/organisation";
import type { Dot } from "@shared/types";

export const A = "dot_eng" as Dot["id"];
export const B = "dot_sec" as Dot["id"];

export function dot(id: Dot["id"], name: string, emoji: string): Dot {
	return {
		id,
		kind: "standard",
		name,
		appearance: { emoji, color: "teal" },
		archived: false,
		pinned: false,
		lastActivityAt: "2026-01-01T00:00:00Z",
	} as unknown as Dot;
}

export const DOTS: Dot[] = [dot(A, "Engineering", "E"), dot(B, "Security", "S")];

export const DOMAINS: OrgDomain[] = [
	{
		id: "engineering",
		name: "Engineering",
		emoji: "E",
		color: "teal",
		tagline: "Builds it",
		skillIds: [],
		reviewedBy: [],
	},
	{
		id: "security",
		name: "Security",
		emoji: "S",
		color: "teal",
		tagline: "Keeps it safe",
		skillIds: [],
		reviewedBy: [],
	},
	{ id: "hr", name: "HR", emoji: "H", color: "teal", tagline: "People", skillIds: [], reviewedBy: [] },
];

export const TEMPLATES: OrgTemplate[] = [
	{ id: "startup", name: "Startup", description: "A small, fast team.", domains: ["engineering", "security"] },
	{ id: "full", name: "Everything", description: "All departments.", domains: ["engineering", "security", "hr"] },
];

export const MEMBERS: OrgMember[] = [
	{ dotId: A, domain: "engineering", skillIds: ["builtin:ship"] },
	{ dotId: B, domain: "security", skillIds: [] },
];

export const ORG: OrgState = { created: true, name: "Acme", members: MEMBERS };
export const NO_ORG: OrgState = { created: false, name: "", members: [] };

export const SKILLS: SkillSummary[] = [
	{ id: "builtin:ship", name: "Ship a change", description: "How we ship", domain: "engineering", builtin: true },
	{ id: "user:mine", name: "My playbook", description: "Mine", domain: "security", builtin: false },
	{ id: "builtin:status", name: "Write a status update", description: "Shared one", builtin: true },
];

export function task(id: string, over: Partial<OrgTask> = {}): OrgTask {
	return {
		id,
		title: `Task ${id}`,
		brief: `Brief for ${id}`,
		assignee: A,
		dependsOn: [],
		status: "pending",
		attempt: 0,
		reviews: [],
		deliverables: [],
		...over,
	};
}

export function project(over: Partial<OrgProject> = {}): OrgProject {
	return {
		id: "prj_1",
		title: "Add sign-in",
		brief: "Add single sign-on",
		status: "running",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		tasks: [],
		concurrency: 3,
		maxRevisions: 2,
		spentUsd: 1.5,
		log: [],
		...over,
	};
}
