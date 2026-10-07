import type { SkillSummary } from "@shared/organisation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, EmptyState, Input } from "@/design-system/components";
import { IconFileText, IconPlus, IconSearch } from "@/design-system/icons";
import { errorText } from "@/lib/api";
import { useOrganisation } from "@/stores/organisation";
import { SkillDialog } from "./SkillDialog";
import { Unavailable } from "./shared-ui";

export function groupSkills(
	skills: SkillSummary[],
	query: string,
	domainName: (id: string) => string,
): Array<{ key: string; label: string; items: SkillSummary[] }> {
	const q = query.trim().toLowerCase();
	const hit = (s: SkillSummary) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
	const map = new Map<string, SkillSummary[]>();
	for (const s of skills.filter(hit)) map.set(s.domain ?? "", [...(map.get(s.domain ?? "") ?? []), s]);
	return [...map.entries()]
		.sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : domainName(a).localeCompare(domainName(b))))
		.map(([key, items]) => ({
			key,
			label: key ? domainName(key) : "Shared",
			items: items.sort((a, b) => a.name.localeCompare(b.name)),
		}));
}

export function SkillsView() {
	const skills = useOrganisation((s) => s.skills);
	const domains = useOrganisation((s) => s.domains);
	const [query, setQuery] = useState("");
	const [failed, setFailed] = useState<string | null>(null);
	const [open, setOpen] = useState<{ id?: string } | null>(null);

	const load = () => {
		setFailed(null);
		void Promise.all([useOrganisation.getState().loadCatalog(), useOrganisation.getState().refreshSkills()]).catch(
			(e) => setFailed(errorText(e)),
		);
	};
	useEffect(load, []);

	const domainName = (id: string) => domains.find((d) => d.id === id)?.name ?? id;
	const groups = useMemo(
		() => groupSkills(skills, query, (id) => domains.find((d) => d.id === id)?.name ?? id),
		[skills, query, domains],
	);

	if (failed && skills.length === 0) return <Unavailable onRetry={load} detail={failed} />;

	return (
		<section aria-label="Skills" className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<h2 className="flex-1 text-xl font-semibold text-fg">Skills</h2>
				<Button leadingIcon={<IconPlus size={16} />} onClick={() => setOpen({})}>
					New skill
				</Button>
			</div>
			<p className="text-sm text-fg-2">
				Skills are playbooks your Dots follow. Built-in ones can't be changed, but you can duplicate them.
			</p>
			<div className="max-w-[360px]">
				<Input
					aria-label="Search skills"
					placeholder="Search skills"
					leading={<IconSearch size={14} />}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>
			{groups.length === 0 ? (
				<div className="py-10">
					<EmptyState
						icon={<IconFileText size={28} />}
						title={query ? "No skills match" : "No skills yet"}
						body={query ? "Try a different word." : "Create your first skill to teach your team how you work."}
					/>
				</div>
			) : (
				groups.map((g) => (
					<section key={g.key || "shared"} aria-label={g.label} className="flex flex-col gap-2">
						<h3 className="text-xs font-medium uppercase tracking-wide text-fg-3">{g.label}</h3>
						<ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-elevated">
							{g.items.map((s) => (
								<li key={s.id}>
									<button
										type="button"
										onClick={() => setOpen({ id: s.id })}
										className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-hover"
									>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-medium text-fg">{s.name}</span>
											<span className="block truncate text-xs text-fg-3">{s.description}</span>
										</span>
										{s.builtin && <Badge variant="muted">Built-in</Badge>}
									</button>
								</li>
							))}
						</ul>
					</section>
				))
			)}
			{open && <SkillDialog skillId={open.id} domainName={domainName} onClose={() => setOpen(null)} />}
		</section>
	);
}
