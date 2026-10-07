import type { OrgProjectSummary } from "@shared/organisation";
import { useState } from "react";
import { navigate } from "@/app/router";
import { Badge, Button, EmptyState } from "@/design-system/components";
import { IconClose, IconPlus, IconSparkles } from "@/design-system/icons";
import { relativeTime } from "@/lib/format";
import { useOrganisation } from "@/stores/organisation";
import { PROJECT_STATUS, spendLabel } from "./labels";
import { NewProjectDialog } from "./NewProjectDialog";
import { Callout } from "./shared-ui";

function ProjectCard({ p }: { p: OrgProjectSummary }) {
	const st = PROJECT_STATUS[p.status];
	return (
		<button
			type="button"
			onClick={() => navigate(`#/organisation/${p.id}`)}
			className="flex w-full flex-col gap-2 rounded-lg border border-border-subtle bg-elevated p-4 text-left transition-colors hover:bg-hover"
		>
			<span className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate text-md font-semibold text-fg">{p.title}</span>
				{p.attention > 0 && (
					<Badge variant="unread" count={p.attention} aria-label={`${p.attention} waiting for you`} />
				)}
				<Badge variant={st.tone}>{st.label}</Badge>
			</span>
			<span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-3">
				<span>
					{p.doneCount} of {p.taskCount}
				</span>
				<span>{spendLabel(p.spentUsd)}</span>
				<span>Updated {relativeTime(p.updatedAt)}</span>
			</span>
		</button>
	);
}

export function ProjectsView() {
	const projects = useOrganisation((s) => s.projects);
	const welcome = useOrganisation((s) => s.welcome);
	const [open, setOpen] = useState(false);

	return (
		<section aria-label="Projects" className="flex flex-col gap-4">
			{welcome && (
				<div className="flex items-start gap-3">
					<div className="flex-1">
						<Callout tone="success" title="Your team is ready">
							Try: Ask SuperDot to plan a project with your team, or start one here.
						</Callout>
					</div>
					<Button
						variant="ghost"
						size="sm"
						aria-label="Dismiss"
						onClick={() => useOrganisation.getState().setWelcome(false)}
					>
						<IconClose size={14} />
					</Button>
				</div>
			)}
			<div className="flex items-center gap-2">
				<h2 className="flex-1 text-xl font-semibold text-fg">Projects</h2>
				<Button leadingIcon={<IconPlus size={16} />} onClick={() => setOpen(true)}>
					New project
				</Button>
			</div>
			{projects.length === 0 ? (
				<div className="py-12">
					<EmptyState
						icon={<IconSparkles size={28} />}
						title="No projects yet"
						body="Give SuperDot a request and your team will plan and do the work."
						action={{ label: "New project", onClick: () => setOpen(true) }}
					/>
				</div>
			) : (
				<ul className="flex flex-col gap-3">
					{projects.map((p) => (
						<li key={p.id}>
							<ProjectCard p={p} />
						</li>
					))}
				</ul>
			)}
			<NewProjectDialog open={open} onOpenChange={setOpen} />
		</section>
	);
}
