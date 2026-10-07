import type {
	OrgDomain,
	OrgProject,
	OrgProjectSummary,
	OrgState,
	OrgTemplate,
	SkillSummary,
} from "@shared/organisation";
import { summarizeProject } from "@shared/organisation";
import { create } from "zustand";
import { api, errorText } from "../lib/api";

interface OrganisationStore {
	org: OrgState | null;
	templates: OrgTemplate[];
	domains: OrgDomain[];
	catalogLoaded: boolean;
	projects: OrgProjectSummary[];
	/** Full projects that were opened or pushed by `org:project`. */
	byId: Record<string, OrgProject>;
	skills: SkillSummary[];
	loaded: boolean;
	/** Plain-language reason the organisation couldn't be loaded (the backend may not be ready). */
	error: string | null;
	/** Show the "Your team is ready" hint on the Projects screen. */
	welcome: boolean;
	load(): Promise<void>;
	loadCatalog(): Promise<void>;
	refreshState(): Promise<void>;
	refreshSkills(): Promise<void>;
	loadProject(id: string): Promise<OrgProject>;
	setOrg(s: OrgState): void;
	setProject(p: OrgProject): void;
	setSkills(s: SkillSummary[]): void;
	setWelcome(v: boolean): void;
}

function sortSummaries(list: OrgProjectSummary[]): OrgProjectSummary[] {
	return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const useOrganisation = create<OrganisationStore>((set, get) => ({
	org: null,
	templates: [],
	domains: [],
	catalogLoaded: false,
	projects: [],
	byId: {},
	skills: [],
	loaded: false,
	error: null,
	welcome: false,
	async load() {
		try {
			const org = await api.org.state();
			set({ org, error: null, loaded: true });
			const [projects, skills] = await Promise.all([
				api.org.projects().catch(() => get().projects),
				api.org.skills().catch(() => get().skills),
			]);
			set({ projects: sortSummaries(projects), skills });
		} catch (e) {
			set({ error: errorText(e), loaded: true });
		}
	},
	async loadCatalog() {
		if (get().catalogLoaded) return;
		const c = await api.org.catalog();
		set({ templates: c.templates, domains: c.domains, catalogLoaded: true });
	},
	async refreshState() {
		set({ org: await api.org.state() });
	},
	async refreshSkills() {
		set({ skills: await api.org.skills() });
	},
	async loadProject(id) {
		const p = await api.org.project(id);
		get().setProject(p);
		return p;
	},
	setOrg(org) {
		set({ org, error: null });
	},
	setProject(p) {
		set((s) => ({
			byId: { ...s.byId, [p.id]: p },
			projects: sortSummaries([...s.projects.filter((x) => x.id !== p.id), summarizeProject(p)]),
		}));
	},
	setSkills(skills) {
		set({ skills });
	},
	setWelcome(welcome) {
		set({ welcome });
	},
}));

/** Things only the user can move forward, across all projects (the badge on the Organisation item). */
export function totalAttention(projects: OrgProjectSummary[]): number {
	return projects.reduce((n, p) => n + p.attention, 0);
}
