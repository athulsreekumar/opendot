// The organisation's team file: ~/.opendot/organisation/org.json (docs/spec/15-organisation.md §2).
// Written by TeamService, read by ProjectService (and anything else that needs the member list).
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import writeFileAtomic from "write-file-atomic";
import type { OrgMember, OrgState } from "../../shared/organisation";

export const emptyOrgState = (): OrgState => ({ created: false, name: "", members: [] });

export class OrgStore {
	readonly file: string;
	private cache: OrgState | undefined;

	constructor(root: string) {
		this.file = join(root, "organisation", "org.json");
	}

	async read(): Promise<OrgState> {
		if (this.cache) return structuredClone(this.cache);
		try {
			const raw = JSON.parse(await readFile(this.file, "utf8")) as Partial<OrgState>;
			const members = Array.isArray(raw.members)
				? raw.members.filter((m): m is OrgMember => !!m && typeof m.dotId === "string" && typeof m.domain === "string")
				: [];
			this.cache = {
				created: raw.created === true || members.length > 0,
				name: typeof raw.name === "string" ? raw.name : "",
				...(typeof raw.templateId === "string" ? { templateId: raw.templateId } : {}),
				members: members.map((m) => ({ ...m, skillIds: Array.isArray(m.skillIds) ? m.skillIds : [] })),
			};
		} catch {
			this.cache = emptyOrgState();
		}
		return structuredClone(this.cache);
	}

	async write(state: OrgState): Promise<void> {
		this.cache = structuredClone(state);
		await mkdir(dirname(this.file), { recursive: true });
		await writeFileAtomic(this.file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
	}
}
