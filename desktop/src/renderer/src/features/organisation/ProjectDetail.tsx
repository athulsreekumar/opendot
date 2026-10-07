import { isProjectFinished, type OrgProject } from "@shared/organisation";
import { useEffect, useState } from "react";
import { navigate } from "@/app/router";
import { Badge, Button, Dialog, DialogFooter, SegmentedControl, toast } from "@/design-system/components";
import { IconChevronRight, IconPause, IconPlay } from "@/design-system/icons";
import { Markdown } from "@/features/chats/Markdown";
import { api, errorText } from "@/lib/api";
import { useOrganisation } from "@/stores/organisation";
import { ActivityLog } from "./ActivityLog";
import { Board, TaskList } from "./Board";
import { PROJECT_STATUS, spendLabel } from "./labels";
import { PlanEditor } from "./PlanEditor";
import { Callout, Unavailable } from "./shared-ui";
import { TaskDrawer } from "./TaskDrawer";

function PlanningSkeleton() {
	return (
		<div role="status" aria-label="SuperDot is planning" className="flex flex-col gap-3">
			<p className="text-md font-medium text-fg">SuperDot is planning…</p>
			<p className="text-sm text-fg-2">It is reading your request and splitting it up between your team.</p>
			{[0, 1, 2, 3].map((i) => (
				<div
					key={i}
					data-testid="plan-skeleton-row"
					className="h-16 animate-pulse rounded-lg border border-border-subtle bg-sunken"
				/>
			))}
		</div>
	);
}

function Header({ project, onAfterDelete }: { project: OrgProject; onAfterDelete: () => void }) {
	const st = PROJECT_STATUS[project.status];
	const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
	const [busy, setBusy] = useState(false);
	const run = async (fn: () => Promise<void>, failTitle: string) => {
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			toast({ title: failTitle, description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};
	const finished = isProjectFinished(project.status);
	return (
		<header className="flex flex-col gap-3">
			<Button
				variant="link"
				size="sm"
				className="self-start"
				leadingIcon={<IconChevronRight size={14} className="rotate-180" />}
				onClick={() => navigate("#/organisation")}
			>
				All projects
			</Button>
			<div className="flex flex-wrap items-center gap-3">
				<h2 className="min-w-0 flex-1 text-2xl font-semibold text-fg">{project.title}</h2>
				<Badge variant={st.tone}>{st.label}</Badge>
				<span className="text-sm text-fg-2">{spendLabel(project.spentUsd, project.budgetUsd)}</span>
				{project.status === "running" && (
					<Button
						variant="secondary"
						leadingIcon={<IconPause size={14} />}
						disabled={busy}
						onClick={() => void run(() => api.org.pause(project.id), "Couldn't pause")}
					>
						Pause
					</Button>
				)}
				{project.status === "paused" && (
					<Button
						leadingIcon={<IconPlay size={14} />}
						disabled={busy}
						onClick={() => void run(() => api.org.resume(project.id), "Couldn't resume")}
					>
						Resume
					</Button>
				)}
				{!finished && (
					<Button variant="ghost" className="text-danger" disabled={busy} onClick={() => setConfirm("cancel")}>
						Cancel project
					</Button>
				)}
				{finished && (
					<Button variant="ghost" className="text-danger" disabled={busy} onClick={() => setConfirm("delete")}>
						Delete
					</Button>
				)}
			</div>
			{project.statusNote && (
				<Callout tone={project.status === "failed" ? "danger" : "warning"}>{project.statusNote}</Callout>
			)}
			<Dialog
				open={confirm !== null}
				onOpenChange={(o) => !o && setConfirm(null)}
				size="sm"
				title={confirm === "delete" ? "Delete this project?" : "Cancel this project?"}
				description={
					confirm === "delete"
						? "The project and its history are removed. Files your Dots made stay where they are."
						: "Running tasks are stopped and unfinished tasks are skipped."
				}
				footer={
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirm(null)}>
							Keep it
						</Button>
						<Button
							variant="danger"
							loading={busy}
							onClick={() =>
								void run(
									async () => {
										if (confirm === "delete") {
											await api.org.deleteProject(project.id);
											useOrganisation.setState((s) => ({
												projects: s.projects.filter((p) => p.id !== project.id),
											}));
											onAfterDelete();
										} else {
											await api.org.cancel(project.id);
										}
										setConfirm(null);
									},
									confirm === "delete" ? "Couldn't delete it" : "Couldn't cancel it",
								)
							}
						>
							{confirm === "delete" ? "Delete project" : "Cancel project"}
						</Button>
					</DialogFooter>
				}
			>
				{null}
			</Dialog>
		</header>
	);
}

function Work({ project }: { project: OrgProject }) {
	const [view, setView] = useState("board");
	const [openId, setOpenId] = useState<string | null>(null);
	return (
		<>
			{project.summary && (
				<section aria-label="Summary" className="rounded-lg border border-border-subtle bg-elevated p-4">
					<h3 className="mb-1 text-lg font-semibold text-fg">Summary</h3>
					<div className="od-selectable text-sm text-fg">
						<Markdown text={project.summary} />
					</div>
				</section>
			)}
			<section aria-label="Tasks" className="flex flex-col gap-3">
				<div className="flex items-center gap-2">
					<h3 className="flex-1 text-lg font-semibold text-fg">Tasks</h3>
					<SegmentedControl
						size="sm"
						aria-label="View"
						value={view}
						onValueChange={setView}
						options={[
							{ value: "board", label: "Board" },
							{ value: "list", label: "List" },
						]}
					/>
				</div>
				{project.tasks.length === 0 ? (
					<p className="text-sm text-fg-2">This project has no tasks.</p>
				) : view === "board" ? (
					<Board tasks={project.tasks} onOpen={setOpenId} />
				) : (
					<TaskList tasks={project.tasks} onOpen={setOpenId} />
				)}
			</section>
			<ActivityLog log={project.log} />
			<TaskDrawer project={project} taskId={openId} onClose={() => setOpenId(null)} />
		</>
	);
}

export function ProjectDetail({ projectId }: { projectId: string }) {
	const project = useOrganisation((s) => s.byId[projectId]);
	const [error, setError] = useState<string | null>(null);

	const load = () => {
		setError(null);
		useOrganisation
			.getState()
			.loadProject(projectId)
			.catch((e) => setError(errorText(e)));
	};
	useEffect(load, [projectId]);

	if (!project) {
		return error ? (
			<Unavailable onRetry={load} detail={error} />
		) : (
			<p className="px-2 py-12 text-center text-sm text-fg-2">Loading…</p>
		);
	}
	return (
		<div className="flex flex-col gap-6" data-testid="project-detail">
			<Header project={project} onAfterDelete={() => navigate("#/organisation")} />
			{project.status === "planning" ? (
				<PlanningSkeleton />
			) : project.status === "awaiting-approval" ? (
				<PlanEditor project={project} />
			) : (
				<Work project={project} />
			)}
			{project.status === "awaiting-approval" && <ActivityLog log={project.log} />}
		</div>
	);
}
