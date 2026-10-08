import type { Dot, DotId, DotLink, LinkDecision } from "@shared/types";
import { useMemo, useState } from "react";
import { Avatar } from "@/design-system/components";

export interface GraphEdge {
	from: DotId;
	to: DotId;
	decision: LinkDecision;
	/** Explicit dot to dot deny. */
	explicitDeny: boolean;
}

/** Edges to draw: effective allows, plus explicit dot→dot denies. */
export function buildEdges(dots: Dot[], links: DotLink[], decisions: Record<string, LinkDecision>): GraphEdge[] {
	const edges: GraphEdge[] = [];
	for (const a of dots) {
		for (const b of dots) {
			if (a.id === b.id) continue;
			const decision = decisions[`${a.id}>${b.id}`];
			if (!decision) continue;
			const rule = decision.ruleId ? links.find((l) => l.id === decision.ruleId) : undefined;
			const explicitDeny =
				!decision.allowed && !!rule && rule.effect === "deny" && rule.from.kind === "dot" && rule.to.kind === "dot";
			if (decision.allowed || explicitDeny) edges.push({ from: a.id, to: b.id, decision, explicitDeny });
		}
	}
	return edges;
}

const SIZE = 440;
const NODE_R = 20;

export function LinkGraph({
	dots,
	links,
	decisions,
	onOpenRule,
}: {
	dots: Dot[];
	links: DotLink[];
	decisions: Record<string, LinkDecision>;
	onOpenRule: (id: string) => void;
}) {
	const [hover, setHover] = useState<DotId | undefined>();
	const edges = useMemo(() => buildEdges(dots, links, decisions), [dots, links, decisions]);

	const pos = useMemo(() => {
		const c = SIZE / 2;
		const radius = Math.min(SIZE / 2 - 56, 70 + dots.length * 12);
		const map: Record<string, { x: number; y: number }> = {};
		dots.forEach((d, i) => {
			if (dots.length === 1) map[d.id] = { x: c, y: c };
			else {
				const angle = (i / dots.length) * Math.PI * 2 - Math.PI / 2;
				map[d.id] = { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
			}
		});
		return map;
	}, [dots]);

	return (
		<svg
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			className="h-auto w-full max-w-[520px]"
			role="img"
			aria-label="Which Dots can message each other"
		>
			<defs>
				<marker
					id="od-arrow-accent"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto"
				>
					<path d="M0 0 L10 5 L0 10 z" className="fill-accent" />
				</marker>
				<marker
					id="od-arrow-danger"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto"
				>
					<path d="M0 0 L10 5 L0 10 z" className="fill-danger" />
				</marker>
			</defs>
			{edges.map((e) => {
				const a = pos[e.from];
				const b = pos[e.to];
				if (!a || !b) return null;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const len = Math.hypot(dx, dy) || 1;
				const ux = dx / len;
				const uy = dy / len;
				const sx = a.x + ux * (NODE_R + 2);
				const sy = a.y + uy * (NODE_R + 2);
				const ex = b.x - ux * (NODE_R + 6);
				const ey = b.y - uy * (NODE_R + 6);
				const bend = 22;
				const mx = (sx + ex) / 2 - uy * bend;
				const my = (sy + ey) / 2 + ux * bend;
				const dim = hover && e.from !== hover && e.to !== hover;
				const ask = e.decision.approval === "ask";
				const cls = e.explicitDeny ? "stroke-danger" : "stroke-accent";
				const qx = 0.25 * sx + 0.5 * mx + 0.25 * ex;
				const qy = 0.25 * sy + 0.5 * my + 0.25 * ey;
				return (
					// biome-ignore lint/a11y/useSemanticElements: svg group acts as a button
					<g
						key={`${e.from}>${e.to}`}
						role="button"
						tabIndex={0}
						aria-label={`${e.explicitDeny ? "Blocked" : ask ? "Asks first" : "Allowed"}: open rule`}
						opacity={dim ? 0.15 : 1}
						className="cursor-pointer outline-none"
						onClick={() => e.decision.ruleId && onOpenRule(e.decision.ruleId)}
						onKeyDown={(ev) => {
							if ((ev.key === "Enter" || ev.key === " ") && e.decision.ruleId) onOpenRule(e.decision.ruleId);
						}}
					>
						<path d={`M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`} fill="none" strokeWidth={14} stroke="transparent" />
						<path
							d={`M${sx} ${sy} Q${mx} ${my} ${ex} ${ey}`}
							fill="none"
							strokeWidth={hover && !dim ? 2.5 : 1.75}
							strokeDasharray={e.explicitDeny || ask ? "5 4" : undefined}
							markerEnd={e.explicitDeny ? undefined : "url(#od-arrow-accent)"}
							className={cls}
						/>
						{e.explicitDeny && (
							<text
								x={qx}
								y={qy}
								textAnchor="middle"
								dominantBaseline="central"
								className="fill-danger text-sm font-bold"
							>
								✕
							</text>
						)}
					</g>
				);
			})}
			{dots.map((d) => {
				const p = pos[d.id];
				if (!p) return null;
				return (
					<g
						key={d.id}
						onMouseEnter={() => setHover(d.id)}
						onMouseLeave={() => setHover(undefined)}
						opacity={
							hover &&
							hover !== d.id &&
							!edges.some((e) => (e.from === hover && e.to === d.id) || (e.to === hover && e.from === d.id))
								? 0.45
								: 1
						}
					>
						<foreignObject x={p.x - NODE_R} y={p.y - NODE_R} width={NODE_R * 2} height={NODE_R * 2}>
							<Avatar
								size="md"
								icon={d.appearance.icon}
								color={d.appearance.color}
								name={d.name}
								mark={d.kind === "super"}
							/>
						</foreignObject>
						<text x={p.x} y={p.y + NODE_R + 14} textAnchor="middle" className="fill-fg-2 text-xs">
							{d.name.length > 14 ? `${d.name.slice(0, 13)}…` : d.name}
						</text>
					</g>
				);
			})}
		</svg>
	);
}
