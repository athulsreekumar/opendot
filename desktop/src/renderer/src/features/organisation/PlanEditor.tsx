import { ORG_LIMITS, type OrgProject, type OrgTaskInput, type PlanProblem, validatePlan } from "@shared/organisation";
import { useEffect, useMemo, useState } from "react";
import { Button, IconButton, Input, Select, type SelectGroup, TextArea, toast } from "@/design-system/components";
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useOrganisation } from "@/stores/organisation";
import { useMemberLookup, useMembers } from "./members";
import { Callout, CheckRow, Field } from "./shared-ui";

const NO_REVIEWER = "__none";

export function toInputs(p: OrgProject): OrgTaskInput[] {
	return p.tasks.map((t) => ({
		id: t.id,
		title: t.title,
		brief: t.brief,
		assignee: t.assignee,
		dependsOn: [...t.dependsOn],
		...(t.reviewer ? { reviewer: t.reviewer } : {}),
	}));
}

export function nextTaskId(tasks: OrgTaskInput[]): string {
	let n = tasks.length + 1;
	const ids = new Set(tasks.map((t) => t.id));
	while (ids.has(`t${n}`)) n++;
	return `t${n}`;
}

function sameInputs(a: OrgTaskInput[], b: OrgTaskInput[]): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

interface RowProps {
	task: OrgTaskInput;
	index: number;
	count: number;
	all: OrgTaskInput[];
	problems: PlanProblem[];
	onChange: (t: OrgTaskInput) => void;
	onMove: (dir: -1 | 1) => void;
	onRemove: () => void;
}

function TaskRow({ task, index, count, all, problems, onChange, onMove, onRemove }: RowProps) {
	const members = useMembers();
	const lookup = useMemberLookup();
	const people: SelectGroup[] = [
		{
			items: [
				...members.map((m) => ({ value: m.dotId as string, label: `${lookup(m.dotId).name} (${m.domain})` })),
				{ value: "human", label: "Me" },
			],
		},
	];
	const reviewers: SelectGroup[] = [{ items: [{ value: NO_REVIEWER, label: "No reviewer" }, ...people[0]!.items] }];
	const others = all.filter((t) => t.id !== task.id);
	return (
		<li
			aria-label={`Task ${index + 1}`}
			className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-elevated p-4"
		>
			<div className="flex items-center gap-1">
				<span className="flex-1 text-xs font-medium uppercase tracking-wide text-fg-3">Task {index + 1}</span>
				<IconButton
					size="sm"
					label="Move up"
					disabled={index === 0}
					onClick={() => onMove(-1)}
					icon={<IconChevronUp size={16} />}
				/>
				<IconButton
					size="sm"
					label="Move down"
					disabled={index === count - 1}
					onClick={() => onMove(1)}
					icon={<IconChevronDown size={16} />}
				/>
				<IconButton size="sm" label="Remove task" onClick={onRemove} icon={<IconTrash size={16} />} />
			</div>
			<Field label="Title" htmlFor={`pt-title-${task.id}`}>
				<Input
					id={`pt-title-${task.id}`}
					value={task.title}
					maxLength={ORG_LIMITS.titleMax}
					onChange={(e) => onChange({ ...task, title: e.target.value })}
				/>
			</Field>
			<Field label="Brief" htmlFor={`pt-brief-${task.id}`}>
				<TextArea
					id={`pt-brief-${task.id}`}
					value={task.brief}
					minRows={2}
					autoGrow
					maxLength={ORG_LIMITS.briefMax}
					onChange={(e) => onChange({ ...task, brief: e.target.value })}
				/>
			</Field>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<span className="text-sm font-medium text-fg">Assignee</span>
					<Select
						aria-label={`Assignee for task ${index + 1}`}
						value={task.assignee}
						groups={people}
						onValueChange={(v) => onChange({ ...task, assignee: v as OrgTaskInput["assignee"] })}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<span className="text-sm font-medium text-fg">Reviewer</span>
					<Select
						aria-label={`Reviewer for task ${index + 1}`}
						value={task.reviewer ?? NO_REVIEWER}
						groups={reviewers}
						onValueChange={(v) => {
							const { reviewer: _drop, ...rest } = task;
							onChange(v === NO_REVIEWER ? rest : { ...rest, reviewer: v as OrgTaskInput["assignee"] });
						}}
					/>
				</div>
			</div>
			{others.length > 0 && (
				<fieldset>
					<legend className="mb-1.5 text-sm font-medium text-fg">Depends on</legend>
					<div className="flex flex-col gap-1.5">
						{others.map((o) => (
							<CheckRow
								key={o.id}
								checked={task.dependsOn.includes(o.id)}
								onChange={(on) =>
									onChange({
										...task,
										dependsOn: on ? [...task.dependsOn, o.id] : task.dependsOn.filter((d) => d !== o.id),
									})
								}
							>
								<span className="truncate">{o.title.trim() || `Task ${all.indexOf(o) + 1}`}</span>
							</CheckRow>
						))}
					</div>
				</fieldset>
			)}
			{problems.length > 0 && (
				<ul className="flex flex-col gap-0.5 text-xs text-danger" aria-label="Problems with this task">
					{problems.map((p) => (
						<li key={p.message}>{p.message}</li>
					))}
				</ul>
			)}
		</li>
	);
}

export function PlanEditor({ project }: { project: OrgProject }) {
	const members = useMembers();
	const [draft, setDraft] = useState<OrgTaskInput[]>(() => toInputs(project));
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [busy, setBusy] = useState(false);
	const saved = useMemo(() => toInputs(project), [project]);
	const dirty = !sameInputs(draft, saved);

	// Pick up a changed plan (for example a replan) while the user has no edits of their own.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only react to the saved plan changing
	useEffect(() => {
		setDraft((cur) => (sameInputs(cur, saved) ? cur : dirty ? cur : saved));
	}, [saved]);

	const known = useMemo(() => new Set(members.map((m) => m.dotId as string)), [members]);
	const problems = useMemo(() => validatePlan(draft, (id) => known.has(id)), [draft, known]);
	const general = problems.filter((p) => !p.taskId);
	const forTask = (id: string) => problems.filter((p) => p.taskId === id);

	const update = (i: number, t: OrgTaskInput) => setDraft((d) => d.map((x, j) => (j === i ? t : x)));
	const move = (i: number, dir: -1 | 1) =>
		setDraft((d) => {
			const j = i + dir;
			if (j < 0 || j >= d.length) return d;
			const next = [...d];
			[next[i], next[j]] = [next[j]!, next[i]!];
			return next;
		});
	const remove = (i: number) =>
		setDraft((d) => {
			const gone = d[i]?.id;
			return d.filter((_, j) => j !== i).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((x) => x !== gone) }));
		});
	const add = () =>
		setDraft((d) => [
			...d,
			{ id: nextTaskId(d), title: "", brief: "", assignee: members[0]?.dotId ?? "human", dependsOn: [] },
		]);

	const guard = async (fn: () => Promise<void>, failTitle: string) => {
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			toast({ title: failTitle, description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	const save = async () => {
		const p = await api.org.savePlan(project.id, draft);
		useOrganisation.getState().setProject(p);
		setDraft(toInputs(p));
	};

	return (
		<section aria-label="Plan review" className="flex flex-col gap-4">
			<div>
				<h2 className="text-xl font-semibold text-fg">Review the plan</h2>
				<p className="mt-1 text-sm text-fg-2">Change anything you like. Nothing starts until you approve.</p>
			</div>
			{project.plannerNote ? (
				<div className="rounded-lg border border-border-subtle bg-sunken p-4 text-sm text-fg">
					<p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-3">SuperDot says</p>
					<p className="whitespace-pre-wrap">{project.plannerNote}</p>
				</div>
			) : null}
			{general.length > 0 && (
				<Callout tone="danger" title="This plan needs a fix">
					<ul className="list-disc pl-4">
						{general.map((p) => (
							<li key={p.message}>{p.message}</li>
						))}
					</ul>
				</Callout>
			)}
			<ol className="flex flex-col gap-3">
				{draft.map((t, i) => (
					<TaskRow
						key={t.id}
						task={t}
						index={i}
						count={draft.length}
						all={draft}
						problems={forTask(t.id)}
						onChange={(nt) => update(i, nt)}
						onMove={(dir) => move(i, dir)}
						onRemove={() => remove(i)}
					/>
				))}
			</ol>
			<div>
				<Button
					variant="secondary"
					leadingIcon={<IconPlus size={16} />}
					disabled={draft.length >= ORG_LIMITS.maxTasks}
					onClick={add}
				>
					Add task
				</Button>
			</div>
			{feedbackOpen && (
				<div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-elevated p-4">
					<Field label="What should change?" htmlFor="replan-feedback">
						<TextArea
							id="replan-feedback"
							value={feedback}
							minRows={2}
							autoGrow
							maxLength={ORG_LIMITS.answerMax}
							placeholder="For example: split the design work and add a security check."
							onChange={(e) => setFeedback(e.target.value)}
						/>
					</Field>
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => setFeedbackOpen(false)}>
							Cancel
						</Button>
						<Button
							loading={busy}
							onClick={() =>
								void guard(async () => {
									await api.org.replan(project.id, feedback.trim() || undefined);
									setFeedbackOpen(false);
									setFeedback("");
								}, "Couldn't ask for a new plan")
							}
						>
							Send to SuperDot
						</Button>
					</div>
				</div>
			)}
			<div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
				<Button
					disabled={busy || problems.length > 0}
					onClick={() =>
						void guard(async () => {
							if (dirty) await save();
							await api.org.approve(project.id);
						}, "Couldn't start the project")
					}
				>
					Approve and start
				</Button>
				<Button
					variant="secondary"
					disabled={busy || !dirty || problems.length > 0}
					onClick={() => void guard(save, "Couldn't save your changes")}
				>
					Save changes
				</Button>
				<Button variant="ghost" disabled={busy} onClick={() => setFeedbackOpen(true)}>
					Ask SuperDot to replan
				</Button>
				{problems.length > 0 && (
					<span className="text-xs text-danger">
						{problems.length === 1 ? "Fix 1 problem to continue." : `Fix ${problems.length} problems to continue.`}
					</span>
				)}
			</div>
		</section>
	);
}
