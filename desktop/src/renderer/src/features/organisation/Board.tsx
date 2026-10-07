import { type OrgTask, readyTaskIds } from "@shared/organisation";
import { cn } from "@/design-system/cn";
import { Badge } from "@/design-system/components";
import { IconError } from "@/design-system/icons";
import { BOARD_COLUMNS, columnTasks, TASK_STATUS } from "./labels";
import { MemberChip } from "./members";

function waitingForUser(t: OrgTask, ready: string[]): boolean {
	if (t.status === "needs-input") return true;
	if (t.status === "review" && t.reviewer === "human") return true;
	if (t.assignee === "human" && (t.status === "running" || (t.status === "pending" && ready.includes(t.id))))
		return true;
	return false;
}

export function TaskCard({ task, ready, onOpen }: { task: OrgTask; ready: string[]; onOpen: () => void }) {
	const failed = task.status === "failed";
	const waiting = waitingForUser(task, ready);
	return (
		<button
			type="button"
			onClick={onOpen}
			data-task-id={task.id}
			data-status={task.status}
			className={cn(
				"flex w-full flex-col gap-2 rounded-md border bg-elevated p-3 text-left transition-colors hover:bg-hover",
				failed ? "border-danger" : "border-border-subtle",
			)}
		>
			<span className="flex items-start gap-1.5">
				{failed && <IconError size={14} className="mt-0.5 shrink-0 text-danger" aria-label="Failed" />}
				<span
					className={cn(
						"min-w-0 flex-1 text-sm font-medium text-fg",
						task.status === "skipped" && "text-fg-3 line-through",
					)}
				>
					{task.title}
				</span>
			</span>
			<MemberChip id={task.assignee} />
			<span className="flex flex-wrap items-center gap-1.5">
				{waiting ? (
					<Badge variant="warning">{task.assignee === "human" ? "Your turn" : "Waiting for you"}</Badge>
				) : (
					<Badge variant={TASK_STATUS[task.status].tone}>{TASK_STATUS[task.status].label}</Badge>
				)}
				{task.dependsOn.length > 0 && (
					<span className="text-2xs text-fg-3">
						Needs {task.dependsOn.length} {task.dependsOn.length === 1 ? "task" : "tasks"}
					</span>
				)}
				{task.attempt > 1 && <Badge variant="outline">Round {task.attempt}</Badge>}
			</span>
		</button>
	);
}

export function Board({ tasks, onOpen }: { tasks: OrgTask[]; onOpen: (id: string) => void }) {
	const ready = readyTaskIds(tasks);
	return (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="board">
			{BOARD_COLUMNS.map((c) => {
				const list = columnTasks(tasks, c.statuses);
				return (
					<section key={c.id} aria-label={c.label} className="flex min-w-0 flex-col gap-2 rounded-lg bg-sunken p-2">
						<h3 className="flex items-center gap-2 px-1 text-sm font-semibold text-fg">
							{c.label}
							<Badge variant="muted">{list.length}</Badge>
						</h3>
						<ul className="flex flex-col gap-2">
							{list.map((t) => (
								<li key={t.id}>
									<TaskCard task={t} ready={ready} onOpen={() => onOpen(t.id)} />
								</li>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}

export function TaskList({ tasks, onOpen }: { tasks: OrgTask[]; onOpen: (id: string) => void }) {
	const ready = readyTaskIds(tasks);
	return (
		<ul
			className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-elevated"
			data-testid="task-list"
		>
			{tasks.map((t) => (
				<li key={t.id}>
					<button
						type="button"
						onClick={() => onOpen(t.id)}
						className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-hover"
					>
						<span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{t.title}</span>
						<MemberChip id={t.assignee} />
						<Badge variant={waitingForUser(t, ready) ? "warning" : TASK_STATUS[t.status].tone}>
							{waitingForUser(t, ready) ? "Waiting for you" : TASK_STATUS[t.status].label}
						</Badge>
					</button>
				</li>
			))}
		</ul>
	);
}
