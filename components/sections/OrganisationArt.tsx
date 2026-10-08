import clsx from "clsx";
import type { CSSProperties } from "react";
import { DeptIcon } from "@/components/ui/DeptIcon";
import { ClipboardList, FileText, Icon, Sparkles, User } from "@/components/ui/Icon";
import { MacWindow } from "@/components/ui/MacWindow";
import { Screenshot } from "@/components/ui/Screenshot";
import { type OrgDept, organisation, orgDepartments } from "@/lib/copy";

/**
 * The illustrated parts of the Organisation storyboard. Everything here is decorative (the story section hides it from
 * assistive tech and carries the same facts as text), and every element is rendered in its FINAL state: GSAP only sets
 * start states while the pinned layout is active, so the stacked layout (phones, reduced motion) shows the finished scene.
 */

const dept = (name: string): OrgDept | undefined => orgDepartments.find((d) => d.name === name);
/** Line icon for a department Dot, or the person icon for "You". */
function DotGlyph({ name, size }: { name: string; size: number }) {
	const d = dept(name);
	if (name === "You") return <Icon as={User} size={size} />;
	return d ? <DeptIcon name={d.icon} size={size} /> : <span>•</span>;
}

function Chip({ name, className }: { name: string; className?: string }) {
	return (
		<span className={clsx("org-chip", className)}>
			<i aria-hidden="true">
				<DotGlyph name={name} size={12} />
			</i>
			{name}
		</span>
	);
}

/** A real app screenshot in a window frame. Sizes are tuned for the pinned stage (about 580px wide) and phones. */
export function Shot({
	name,
	alt,
	theme,
	className,
	sizes = "(min-width: 900px) 580px, 92vw",
	caption,
}: {
	name: string;
	alt: string;
	theme?: "light" | "dark";
	className?: string;
	sizes?: string;
	caption?: string;
}) {
	return (
		<figure className={clsx("org-shot", className)}>
			<MacWindow radius={12}>
				<Screenshot name={name} alt={alt} theme={theme} sizes={sizes} />
			</MacWindow>
			{caption && <figcaption className="org-shot-cap">{caption}</figcaption>}
		</figure>
	);
}

// ── Beat 1: Ask ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function AskArt() {
	const { ask, plan } = organisation;
	return (
		<div className="org-art org-chat" aria-hidden="true">
			<div className="org-chat-head">
				<span className="org-av">
					<Icon as={Sparkles} size={14} />
				</span>
				<span className="org-chat-name">{ask.to}</span>
				<span className="org-chat-sub">Project manager</span>
			</div>
			<div className="org-msg org-msg-user">
				<p className="org-bubble org-bubble-user">
					<span className="org-ask-typed">{ask.request}</span>
					<span className="org-ask-rest" />
				</p>
			</div>
			<div className="org-bot-slot">
				<div className="org-think">
					<span />
					<span />
					<span />
				</div>
				<div className="org-msg org-msg-bot org-reply">
					<p className="org-bubble">{ask.reply}</p>
				</div>
			</div>
			<div className="org-update">
				<span className="org-update-ic">
					<Icon as={ClipboardList} size={18} />
				</span>
				<div className="org-update-text">
					<b>{plan.title}</b>
					<span>The plan is ready to review.</span>
				</div>
				<span className="org-btn">Open project</span>
			</div>
		</div>
	);
}

// ── Beat 2: Plan ─────────────────────────────────────────────────────────────────────────────────────────────────────

const ROW_H = 50;
const GUTTER_W = 84;

function levelOf(n: number, tasks: typeof organisation.plan.tasks): number {
	const t = tasks.find((x) => x.n === n);
	if (!t || t.after.length === 0) return 0;
	return 1 + Math.max(...t.after.map((a) => levelOf(a, tasks)));
}

export function PlanArt() {
	const { plan } = organisation;
	const tasks = plan.tasks;
	const idx = (n: number) => tasks.findIndex((t) => t.n === n);
	const cx = (n: number) => 14 + levelOf(n, tasks) * 28;
	const cy = (n: number) => idx(n) * ROW_H + ROW_H / 2;
	const edges = tasks.flatMap((t) => t.after.map((a) => ({ from: a, to: t.n })));
	return (
		<div className="org-art org-plan-card" aria-hidden="true">
			<header className="org-card-head">
				<span className="org-tag">Plan</span>
				<b className="org-card-title">{plan.title}</b>
				<span className="org-state">
					<span className="org-state-wait">Awaiting approval</span>
					<span className="org-state-run">Running</span>
				</span>
			</header>
			<p className="org-note">{plan.note}</p>
			<div className="org-tasks-wrap">
				<svg
					className="org-deps"
					width={GUTTER_W}
					height={tasks.length * ROW_H}
					viewBox={`0 0 ${GUTTER_W} ${tasks.length * ROW_H}`}
					focusable="false"
					aria-hidden="true"
				>
					{edges.map((e) => {
						const x1 = cx(e.from);
						const y1 = cy(e.from) + 13;
						const x2 = cx(e.to) - 13;
						const y2 = cy(e.to);
						return (
							<path
								key={`${e.from}-${e.to}`}
								className="org-dep"
								d={`M${x1} ${y1}L${x1} ${y2 - 7}Q${x1} ${y2} ${x1 + 7} ${y2}L${x2} ${y2}`}
								pathLength={1}
								fill="none"
								strokeLinecap="round"
							/>
						);
					})}
				</svg>
				<ol className="org-tasks">
					{tasks.map((t) => (
						<li key={t.n} className="org-task" style={{ "--lvl": levelOf(t.n, tasks) } as CSSProperties}>
							<span className="org-n">{t.n}</span>
							<div className="org-task-body">
								<p className="org-task-title">{t.title}</p>
								<p className="org-task-meta">
									<Chip name={t.owner} className="org-owner" />
									<span className="org-rev">
										<span className="org-meta-k">{plan.reviewerLabel}</span>
										<Chip name={t.reviewer} />
									</span>
									{t.after.length > 0 && (
										<span className="org-after">
											{plan.afterLabel} {t.after.join(", ")}
										</span>
									)}
								</p>
							</div>
						</li>
					))}
				</ol>
			</div>
			<footer className="org-card-foot">
				<span className="org-btn org-btn-primary">{plan.approve}</span>
				<span className="org-btn">{plan.replan}</span>
			</footer>
		</div>
	);
}

// ── Beat 3: Split ────────────────────────────────────────────────────────────────────────────────────────────────────

export const SPLIT_W = 580;
export const SPLIT_H = 470;
const CORE = { x: 50, y: 20 };

/** Positions (in %) of the department nodes on an arc beneath SuperDot. */
function nodePos(i: number, count: number) {
	const t = count === 1 ? 0.5 : i / (count - 1);
	const th = Math.PI * (0.1 + 0.8 * t);
	// Rounded so the server and the browser print identical numbers (Math.cos can differ in the last digits).
	return { x: Math.round((50 - 38 * Math.cos(th)) * 10) / 10, y: Math.round((CORE.y + 62 * Math.sin(th)) * 10) / 10 };
}

/** What each department node shows when the scene is finished (and in the stacked layout). */
const NODE_FINAL: Record<string, "done" | "review" | "work" | "none"> = {
	Product: "done",
	Design: "done",
	Support: "done",
	Engineering: "review",
	Security: "work",
	Marketing: "none",
};

const px = (p: { x: number; y: number }) => ({ x: (p.x / 100) * SPLIT_W, y: (p.y / 100) * SPLIT_H });

export function SplitArt() {
	const { split, plan } = organisation;
	const nodes = split.nodes.map((name, i) => ({ name, ...nodePos(i, split.nodes.length) }));
	const owned = (name: string) => plan.tasks.find((t) => t.owner === name);
	const core = px(CORE);
	const eng = nodes.find((n) => n.name === "Engineering");
	const sec = nodes.find((n) => n.name === "Security");
	const chipTasks = plan.tasks.filter((t) => t.n <= 4);
	return (
		<div className="org-art org-split" aria-hidden="true">
			<div className="org-split-in">
				<svg
					className="org-split-lines"
					viewBox={`0 0 ${SPLIT_W} ${SPLIT_H}`}
					preserveAspectRatio="none"
					focusable="false"
					aria-hidden="true"
				>
					{nodes.map((n) => {
						const p = px(n);
						return (
							<path
								key={n.name}
								className="org-line"
								data-node={n.name}
								d={`M${core.x} ${core.y}L${p.x.toFixed(1)} ${p.y.toFixed(1)}`}
								pathLength={1}
								fill="none"
								vectorEffect="non-scaling-stroke"
							/>
						);
					})}
					{eng && sec && (
						<path
							className="org-line org-line-review"
							d={`M${px(eng).x.toFixed(1)} ${px(eng).y.toFixed(1)}L${px(sec).x.toFixed(1)} ${px(sec).y.toFixed(1)}`}
							pathLength={1}
							fill="none"
							vectorEffect="non-scaling-stroke"
						/>
					)}
				</svg>

				<div className="org-core" style={{ left: `${CORE.x}%`, top: `${CORE.y}%` }}>
					<div className="org-core-in">
						<span className="org-core-disc">
							<span className="org-core-ic">
								<Icon as={Sparkles} size={30} />
							</span>
						</span>
						<span className="org-core-name">{split.center}</span>
					</div>
				</div>

				{nodes.map((n) => {
					const t = owned(n.name);
					return (
						<div
							key={n.name}
							className="org-node"
							data-node={n.name}
							data-final={NODE_FINAL[n.name] ?? "none"}
							data-x={n.x}
							data-y={n.y}
							style={{ left: `${n.x}%`, top: `${n.y}%` }}
						>
							<div className="org-node-in">
								<span className="org-node-disc">
									<span className="org-node-lit" />
									<span className="org-node-emoji">
										<DotGlyph name={n.name} size={26} />
									</span>
									<span className="org-badge org-badge-work" />
									<span className="org-badge org-badge-review">●</span>
									<span className="org-badge org-badge-done">✓</span>
								</span>
								<span className="org-node-name">{n.name}</span>
								{t && <span className="org-node-task">Task {t.n}</span>}
							</div>
						</div>
					);
				})}

				{chipTasks.map((t) => (
					<span key={t.n} className="org-fly" data-task={t.n} style={{ left: `${CORE.x}%`, top: `${CORE.y}%` }}>
						<span className="org-fly-in">
							<b>{t.n}</b>
							{t.short}
						</span>
					</span>
				))}
				<span className="org-fly org-fly-review" data-task="review" style={{ left: `${CORE.x}%`, top: `${CORE.y}%` }}>
					<span className="org-fly-in">Review</span>
				</span>
				<p className="org-split-more">{split.more}</p>
			</div>
		</div>
	);
}

/** Left column of the Split beat: the same story as the diagram, as a status list. Also the phone version. */
export type TaskStatus = "waiting" | "working" | "review" | "done";
export const SPLIT_FINAL: Record<number, TaskStatus> = { 1: "done", 2: "done", 3: "review", 4: "done", 5: "waiting" };
const STATUS_LABEL: Record<TaskStatus, string> = {
	waiting: "Waiting",
	working: "Working",
	review: "In review",
	done: "Done",
};

export function SplitList() {
	const { plan } = organisation;
	return (
		<div className="org-art org-split-list" aria-hidden="true">
			<p className="org-list-head">{organisation.split.running}</p>
			<ol>
				{plan.tasks.map((t) => (
					<li key={t.n} className="org-srow" data-task={t.n}>
						<span className="org-n">{t.n}</span>
						<span className="org-srow-main">
							<b>{t.title}</b>
							<Chip name={t.owner} />
						</span>
						<span className="org-stat" data-final={SPLIT_FINAL[t.n]}>
							{(["waiting", "working", "review", "done"] as const).map((s) => (
								<span key={s} className={`org-stat-${s}`} data-s={s}>
									{STATUS_LABEL[s]}
								</span>
							))}
						</span>
					</li>
				))}
			</ol>
		</div>
	);
}

// ── Beat 4: Review ───────────────────────────────────────────────────────────────────────────────────────────────────

export function ReviewArt() {
	const { review } = organisation;
	return (
		<div className="org-art org-review" aria-hidden="true">
			<div className="org-rcard">
				<header className="org-card-head">
					<span className="org-tag">Review</span>
					<b className="org-card-title">{review.title}</b>
				</header>
				<p className="org-flow">
					<Chip name={review.owner} />
					<span className="org-flow-arrow">→</span>
					<Chip name={review.reviewer} />
				</p>
				<ol className="org-rounds">
					<li className="org-round" data-r="1">
						<span className="org-tag org-tag-amber">{review.round1.status}</span>
						<ul>
							{review.round1.notes.map((n, i) => (
								<li key={n}>
									{i + 1}. {n}
								</li>
							))}
						</ul>
					</li>
					<li className="org-round org-round-mid" data-r="rev">
						<span className="org-revised">↻ {review.revised}</span>
					</li>
					<li className="org-round" data-r="2">
						<span className="org-tag org-tag-green">{review.round2.status}</span>
						<p>{review.round2.note}</p>
					</li>
				</ol>
			</div>
			<div className="org-wait">
				<header>
					<span className="org-pulse-dot" />
					{review.waiting.label}
				</header>
				<p>
					<b>{review.waiting.title}</b>
					<Chip name={review.waiting.from} />
				</p>
				<div className="org-wait-btns">
					<span className="org-btn org-btn-primary">{review.waiting.approve}</span>
					<span className="org-btn">{review.waiting.changes}</span>
				</div>
			</div>
		</div>
	);
}

// ── Beat 5: Delivered ────────────────────────────────────────────────────────────────────────────────────────────────

export function DoneArt() {
	const { done } = organisation;
	const [todo, doing, inReview, finished] = done.columns;
	return (
		<div className="org-art org-done" aria-hidden="true">
			<div className="org-board">
				{[todo, doing, inReview].map((c) => (
					<div key={c} className="org-col">
						<p className="org-col-head">
							{c}
							<span>0</span>
						</p>
						<span className="org-col-empty" />
					</div>
				))}
				<div className="org-col org-col-done">
					<p className="org-col-head">
						{finished}
						<span>{done.doneTitles.length}</span>
					</p>
					{done.doneTitles.map((t) => (
						<p key={t} className="org-card">
							<span className="org-card-tick">✓</span>
							{t}
						</p>
					))}
				</div>
			</div>
			<div className="org-report">
				<header>
					<span className="org-av">
						<Icon as={Sparkles} size={14} />
					</span>
					{done.reportLabel}
				</header>
				<p>{done.report}</p>
				<p className="org-deliv-label">{done.deliverablesLabel}</p>
				<ul className="org-deliv">
					{done.deliverables.map((d) => (
						<li key={d}>
							<Icon as={FileText} size={12} />
							{d}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

/** Plain-text version of each beat's illustration, for screen readers. */
export function beatText(id: string): string {
	const o = organisation;
	switch (id) {
		case "ask":
			return `Example request to SuperDot: “${o.ask.request}” SuperDot replies: ${o.ask.reply}`;
		case "plan":
			return `Example plan “${o.plan.title}”. ${o.plan.note} ${o.plan.tasks
				.map(
					(t) =>
						`Task ${t.n}, ${t.title}: owner ${t.owner}, reviewer ${t.reviewer}${
							t.after.length ? `, starts after task ${t.after.join(" and ")}` : ""
						}.`,
				)
				.join(" ")}`;
		case "split":
			return o.split.sr;
		case "review":
			return `Example review of “${o.review.title}”. ${o.review.reviewer} reviews ${o.review.owner}’s work and asks for changes: ${o.review.round1.notes.join(" ")} ${o.review.revised} ${o.review.reviewer} then approves: ${o.review.round2.note} ${o.review.waiting.label}: ${o.review.waiting.from} needs you to approve “${o.review.waiting.title}”.`;
		default:
			return `${o.done.reportLabel}: ${o.done.report} ${o.done.deliverablesLabel}: ${o.done.deliverables.join(", ")}.`;
	}
}
