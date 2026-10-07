import { ORG_LIMITS, type OrgProject, type OrgTask, readyTaskIds } from "@shared/organisation";
import { useState } from "react";
import { Badge, Button, Sheet, TextArea, toast } from "@/design-system/components";
import { IconExternal, IconFile, IconLink } from "@/design-system/icons";
import { Markdown } from "@/features/chats/Markdown";
import { api, errorText } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { TASK_STATUS } from "./labels";
import { MemberChip } from "./members";
import { Callout, Field } from "./shared-ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-1.5">
			<h3 className="text-xs font-medium uppercase tracking-wide text-fg-3">{title}</h3>
			{children}
		</section>
	);
}

function useAction() {
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
	return { busy, run };
}

function NeedsInput({ project, task }: { project: OrgProject; task: OrgTask }) {
	const [answer, setAnswer] = useState("");
	const { busy, run } = useAction();
	return (
		<Section title="Waiting for you">
			<Callout tone="warning">{task.question ?? "This task needs your answer to continue."}</Callout>
			<Field label="Your answer" htmlFor="td-answer">
				<TextArea
					id="td-answer"
					value={answer}
					minRows={2}
					autoGrow
					maxLength={ORG_LIMITS.answerMax}
					onChange={(e) => setAnswer(e.target.value)}
				/>
			</Field>
			<div>
				<Button
					disabled={busy || !answer.trim()}
					loading={busy}
					onClick={() =>
						void run(async () => {
							await api.org.answerTask(project.id, task.id, answer.trim());
							setAnswer("");
						}, "Couldn't send your answer")
					}
				>
					Send answer
				</Button>
			</div>
		</Section>
	);
}

function HumanReview({ project, task }: { project: OrgProject; task: OrgTask }) {
	const [note, setNote] = useState("");
	const { busy, run } = useAction();
	return (
		<Section title="Your review">
			<Field label="Note (needed when you ask for changes)" htmlFor="td-review-note">
				<TextArea
					id="td-review-note"
					value={note}
					minRows={2}
					autoGrow
					maxLength={ORG_LIMITS.answerMax}
					onChange={(e) => setNote(e.target.value)}
				/>
			</Field>
			<div className="flex gap-2">
				<Button
					disabled={busy}
					onClick={() =>
						void run(
							() => api.org.reviewTask(project.id, task.id, "approved", note.trim() || undefined),
							"Couldn't approve",
						)
					}
				>
					Approve
				</Button>
				<Button
					variant="secondary"
					disabled={busy || !note.trim()}
					onClick={() =>
						void run(() => api.org.reviewTask(project.id, task.id, "changes", note.trim()), "Couldn't send your note")
					}
				>
					Request changes
				</Button>
			</div>
		</Section>
	);
}

function HumanTask({ project, task, ready }: { project: OrgProject; task: OrgTask; ready: boolean }) {
	const [note, setNote] = useState("");
	const { busy, run } = useAction();
	const canAct = task.status === "running" || ready;
	return (
		<Section title="Your task">
			{!canAct && <p className="text-sm text-fg-2">This one is yours, once the earlier tasks are finished.</p>}
			<Field label="Note (optional)" htmlFor="td-done-note">
				<TextArea
					id="td-done-note"
					value={note}
					minRows={2}
					autoGrow
					maxLength={ORG_LIMITS.answerMax}
					onChange={(e) => setNote(e.target.value)}
				/>
			</Field>
			<div>
				<Button
					disabled={busy || !canAct}
					onClick={() =>
						void run(() => api.org.completeTask(project.id, task.id, note.trim() || undefined), "Couldn't mark it done")
					}
				>
					I did this
				</Button>
			</div>
		</Section>
	);
}

function Deliverables({ project, task }: { project: OrgProject; task: OrgTask }) {
	if (task.deliverables.length === 0) return null;
	return (
		<Section title="Deliverables">
			<ul className="flex flex-col gap-1.5">
				{task.deliverables.map((d, i) => (
					<li
						key={`${d.kind}-${d.title}-${d.path ?? d.url ?? ""}`}
						className="rounded-md border border-border-subtle bg-elevated px-3 py-2 text-sm"
					>
						<div className="flex items-center gap-2">
							{d.kind === "link" ? <IconLink size={14} /> : <IconFile size={14} />}
							<span className="min-w-0 flex-1 truncate font-medium text-fg">{d.title}</span>
							{d.kind === "file" && (
								<Button
									size="sm"
									variant="secondary"
									aria-label={`Open ${d.title}`}
									trailingIcon={<IconExternal size={12} />}
									onClick={() =>
										void api.org
											.openDeliverable(project.id, task.id, i)
											.catch((e) => toast({ title: "Couldn't open it", description: errorText(e), variant: "error" }))
									}
								>
									Open
								</Button>
							)}
							{d.kind === "link" && d.url && (
								<Button
									size="sm"
									variant="secondary"
									aria-label={`Open ${d.title}`}
									trailingIcon={<IconExternal size={12} />}
									onClick={() => void api.app.openExternal(d.url as string)}
								>
									Open
								</Button>
							)}
						</div>
						{d.kind === "text" && d.text && (
							<p className="od-selectable mt-1 whitespace-pre-wrap text-fg-2">{d.text}</p>
						)}
					</li>
				))}
			</ul>
		</Section>
	);
}

function Failed({ project, task }: { project: OrgProject; task: OrgTask }) {
	const { busy, run } = useAction();
	return (
		<Section title="What went wrong">
			<Callout tone="danger">{task.error ?? "This task didn't finish."}</Callout>
			<div className="flex gap-2">
				<Button
					disabled={busy}
					onClick={() => void run(() => api.org.retryTask(project.id, task.id), "Couldn't retry")}
				>
					Retry
				</Button>
				<Button
					variant="secondary"
					disabled={busy}
					onClick={() => void run(() => api.org.skipTask(project.id, task.id), "Couldn't skip it")}
				>
					Skip
				</Button>
			</div>
		</Section>
	);
}

function TaskBody({ project, task }: { project: OrgProject; task: OrgTask }) {
	const ready = readyTaskIds(project.tasks).includes(task.id);
	const live = project.status === "running" || project.status === "paused" || project.status === "failed";
	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={TASK_STATUS[task.status].tone}>{TASK_STATUS[task.status].label}</Badge>
				{task.attempt > 1 && <Badge variant="outline">Round {task.attempt}</Badge>}
			</div>
			<Section title="Assigned to">
				<MemberChip id={task.assignee} />
			</Section>
			{task.reviewer && (
				<Section title="Reviewer">
					<MemberChip id={task.reviewer} />
				</Section>
			)}
			<Section title="Brief">
				<p className="od-selectable whitespace-pre-wrap text-sm text-fg">{task.brief}</p>
			</Section>
			{live && task.status === "needs-input" && <NeedsInput project={project} task={task} />}
			{live && task.status === "review" && task.reviewer === "human" && <HumanReview project={project} task={task} />}
			{live && task.assignee === "human" && (task.status === "pending" || task.status === "running") && (
				<HumanTask project={project} task={task} ready={ready} />
			)}
			{live && task.status === "failed" && <Failed project={project} task={task} />}
			{live && task.status === "skipped" && <SkippedActions project={project} task={task} />}
			{task.result && (
				<Section title="Result">
					<div className="od-selectable text-sm text-fg">
						<Markdown text={task.result} />
					</div>
				</Section>
			)}
			<Deliverables project={project} task={task} />
			{task.reviews.length > 0 && (
				<Section title="Review history">
					<ul className="flex flex-col gap-2">
						{task.reviews.map((r) => (
							<li
								key={`${r.at}-${r.by}`}
								className="rounded-md border border-border-subtle bg-elevated px-3 py-2 text-sm"
							>
								<div className="flex items-center gap-2">
									<Badge variant={r.verdict === "approved" ? "success" : "warning"}>
										{r.verdict === "approved" ? "Approved" : "Changes asked for"}
									</Badge>
									<MemberChip id={r.by} />
									<span className="flex-1" />
									<time dateTime={r.at} className="text-xs text-fg-3">
										{relativeTime(r.at)}
									</time>
								</div>
								{r.note && <p className="od-selectable mt-1 whitespace-pre-wrap text-fg-2">{r.note}</p>}
							</li>
						))}
					</ul>
				</Section>
			)}
			{live && (task.status === "pending" || task.status === "needs-input") && (
				<SkipOnly project={project} task={task} />
			)}
		</div>
	);
}

function SkippedActions({ project, task }: { project: OrgProject; task: OrgTask }) {
	const { busy, run } = useAction();
	return (
		<div>
			<Button
				variant="secondary"
				disabled={busy}
				onClick={() => void run(() => api.org.retryTask(project.id, task.id), "Couldn't retry")}
			>
				Retry
			</Button>
		</div>
	);
}

function SkipOnly({ project, task }: { project: OrgProject; task: OrgTask }) {
	const { busy, run } = useAction();
	return (
		<div className="border-t border-border-subtle pt-3">
			<Button
				variant="ghost"
				disabled={busy}
				onClick={() => void run(() => api.org.skipTask(project.id, task.id), "Couldn't skip it")}
			>
				Skip this task
			</Button>
		</div>
	);
}

export function TaskDrawer({
	project,
	taskId,
	onClose,
}: {
	project: OrgProject;
	taskId: string | null;
	onClose: () => void;
}) {
	const task = taskId ? project.tasks.find((t) => t.id === taskId) : undefined;
	return (
		<Sheet
			open={!!task}
			onOpenChange={(o) => !o && onClose()}
			title={task?.title ?? "Task"}
			aria-describedby={undefined}
		>
			{task && <TaskBody project={project} task={task} />}
		</Sheet>
	);
}
