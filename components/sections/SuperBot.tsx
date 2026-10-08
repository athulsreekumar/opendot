"use client";

import type { LucideIcon } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { CalendarDays, Icon, Inbox, Plane, Search, Sparkles, Wallet } from "@/components/ui/Icon";
import { MacWindow } from "@/components/ui/MacWindow";
import { Mascot } from "@/components/ui/Mascot";
import { Screenshot } from "@/components/ui/Screenshot";
import { superBot } from "@/lib/copy";
import "./SuperBot.css";
import { LearnMore } from "./LearnMore";

/** One line icon per Dot, same order as superBot.dots. */
const DOT_ICONS = [Inbox, CalendarDays, Search, Wallet, Plane];
// TODO(copy): answer snippets (one per Dot, same order as superBot.dots)
const ANSWERS = [
	"2 emails need replies",
	"Board sync 9:30",
	"3 notes on Northwind",
	"Invoice due Friday",
	"Flight on time",
];

type Pt = { x: number; y: number };
type Leaf = { pos: Pt; label: string; right: boolean; w: number };
type Layout = {
	w: number;
	h: number;
	core: Pt;
	coreR: number;
	nodeR: number;
	nodes: Pt[];
	chips: boolean;
	leaves: Leaf[][];
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const DOT_ANGLES = [-90, -18, 54, 126, 198];
const LEAF_OFFSETS = [-26, -9, 9, 26];
const LEAF_R = 4.5;
const LEAF_FONT = 14;
const leafWidth = (label: string) => Math.round(label.length * 7.4 + 24);

// Desktop tree: SuperDot in the middle, the Dots on an inner ellipse, each Dot's capabilities fanned out on an outer one.
const desktop: Layout = (() => {
	const core = { x: 620, y: 286 };
	const ring = (a: number, rx: number, ry: number) => ({
		x: core.x + rx * Math.cos(rad(a)),
		y: core.y + ry * Math.sin(rad(a)),
	});
	const nodes = DOT_ANGLES.map((a) => ring(a, 270, 128));
	const leaves = DOT_ANGLES.map((a, i) =>
		LEAF_OFFSETS.map((o, k) => {
			const label = (superBot.capabilities[superBot.dots[i] as string] ?? [])[k] ?? "";
			const pos = ring(a + o, 520, 250);
			return { pos, label, right: pos.x >= core.x, w: leafWidth(label) };
		}),
	);
	return { w: 1240, h: 570, core, coreR: 46, nodeR: 30, nodes, chips: true, leaves };
})();

const mobile: Layout = {
	w: 360,
	h: 340,
	core: { x: 180, y: 62 },
	coreR: 40,
	nodeR: 26,
	nodes: [0, 1, 2, 3, 4].map((i) => ({ x: 36 + i * 72, y: 240 })),
	chips: false,
	leaves: [],
};

const r1 = (n: number) => n.toFixed(1);

function pathFor(l: Layout, i: number): string {
	const a = l.core;
	const b = l.nodes[i] as Pt;
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const d = Math.hypot(dx, dy);
	const ux = dx / d;
	const uy = dy / d;
	const s = { x: a.x + ux * (l.coreR + 4), y: a.y + uy * (l.coreR + 4) };
	const e = { x: b.x - ux * (l.nodeR + 4), y: b.y - uy * (l.nodeR + 4) };
	const bend = (i % 2 ? 1 : -1) * Math.min(26, d * 0.08);
	const nx = -uy * bend;
	const ny = ux * bend;
	return `M${r1(s.x)} ${r1(s.y)}C${r1(s.x + dx * 0.35 + nx)} ${r1(s.y + dy * 0.35 + ny)} ${r1(e.x - dx * 0.35 + nx)} ${r1(e.y - dy * 0.35 + ny)} ${r1(e.x)} ${r1(e.y)}`;
}

/** Thin branch from a Dot's outer edge to one of its capability leaves: leaves the Dot radially, arrives radially. */
function leafPathFor(l: Layout, i: number, k: number): string {
	const dot = l.nodes[i] as Pt;
	const leaf = ((l.leaves[i] as Leaf[])[k] as Leaf).pos;
	const unit = (a: Pt, b: Pt) => {
		const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
		return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
	};
	const out = unit(l.core, dot);
	const into = unit(l.core, leaf);
	const s = { x: dot.x + out.x * (l.nodeR + 3), y: dot.y + out.y * (l.nodeR + 3) };
	const e = { x: leaf.x - into.x * (LEAF_R + 2), y: leaf.y - into.y * (LEAF_R + 2) };
	const len = Math.hypot(e.x - s.x, e.y - s.y);
	return `M${r1(s.x)} ${r1(s.y)}C${r1(s.x + out.x * len * 0.4)} ${r1(s.y + out.y * len * 0.4)} ${r1(e.x - into.x * len * 0.3)} ${r1(e.y - into.y * len * 0.3)} ${r1(e.x)} ${r1(e.y)}`;
}

/** Answer chip + name label placement per Dot (offsets from the Dot centre), chosen so they sit in the gaps between branches. */
const BLOCKS: {
	name: { x: number; y: number; anchor: "start" | "middle" | "end" };
	chip: "r" | "l" | "below" | "belowLeft" | "belowRight";
}[] = [
	{ name: { x: -44, y: 0, anchor: "end" }, chip: "r" },
	{ name: { x: 0, y: 50, anchor: "middle" }, chip: "below" },
	{ name: { x: -44, y: 0, anchor: "end" }, chip: "belowLeft" },
	{ name: { x: 44, y: 0, anchor: "start" }, chip: "belowRight" },
	{ name: { x: 0, y: 50, anchor: "middle" }, chip: "below" },
];

function chipLines(text: string): string[] {
	const words = text.split(" ");
	let best = 1;
	let bestDiff = Number.POSITIVE_INFINITY;
	for (let i = 1; i < words.length; i++) {
		const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
		if (diff < bestDiff) {
			best = i;
			bestDiff = diff;
		}
	}
	return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function Diagram({ l, className, animated }: { l: Layout; className: string; animated: boolean }) {
	const uid = animated ? "d" : "m";
	const f = l.chips ? 1 : 0.9;
	return (
		<svg
			className={className}
			viewBox={`0 0 ${l.w} ${l.h}`}
			preserveAspectRatio="xMidYMid meet"
			aria-hidden="true"
			focusable="false"
			fontFamily="inherit"
		>
			<defs>
				<radialGradient id={`sb-glow-${uid}`}>
					<stop offset="0" stopColor="#2dd4bf" stopOpacity="0.55" />
					<stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
				</radialGradient>
				<linearGradient id={`sb-ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#5eead4" />
					<stop offset="1" stopColor="#0e9f8a" />
				</linearGradient>
			</defs>

			{/* Second ring: thin capability branches (drawn first so everything else sits on top). */}
			{l.leaves.map((group, i) =>
				group.map((_, k) => (
					<path
						key={`lp-${superBot.dots[i]}-${k}`}
						className="sb-lpath"
						data-dot={i}
						d={leafPathFor(l, i, k)}
						pathLength={1}
						fill="none"
						stroke="#2dd4bf"
						strokeOpacity="0.32"
						strokeWidth="1"
						strokeLinecap="round"
						strokeDasharray="1"
						strokeDashoffset="0"
					/>
				)),
			)}

			{l.nodes.map((_, i) => (
				<path
					key={superBot.dots[i]}
					className="sb-path"
					d={pathFor(l, i)}
					pathLength={1}
					fill="none"
					stroke="#2dd4bf"
					strokeOpacity="0.55"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeDasharray="1"
					strokeDashoffset="0"
				/>
			))}

			{/* SuperBot core */}
			<g className="sb-core" transform={`translate(${l.core.x} ${l.core.y})`}>
				<circle className="sb-core-glow" r={l.coreR * 1.9} fill={`url(#sb-glow-${uid})`} />
				<circle r={l.coreR} fill="#06231f" stroke={`url(#sb-ring-${uid})`} strokeWidth="3" />
				<circle r={l.coreR - 7} fill="none" stroke="#2dd4bf" strokeOpacity="0.25" />
				<Icon
					as={Sparkles}
					x={-13 * f}
					y={-16 * f}
					width={26 * f}
					height={26 * f}
					style={{ width: 26 * f, height: 26 * f }}
					stroke="#2dd4bf"
					strokeWidth={1.75}
				/>
				<text y={l.coreR * 0.5} textAnchor="middle" fontSize={13 * f} fontWeight="650" fill="#f5f5f7">
					SuperDot
				</text>
			</g>

			{/* Capability leaves: a small node and a compact label pill each. */}
			{l.leaves.map((group, i) =>
				group.map((leaf, k) => {
					const h = 22;
					const px = leaf.right ? LEAF_R + 7 : -(LEAF_R + 7) - leaf.w;
					return (
						<g
							key={`leaf-${superBot.dots[i]}-${k}`}
							className="sb-leaf"
							data-dot={i}
							transform={`translate(${r1(leaf.pos.x)} ${r1(leaf.pos.y)})`}
						>
							<g className="sb-leaf-hot">
								<circle r="15" fill={`url(#sb-glow-${uid})`} />
								<circle r={LEAF_R} fill="#5eead4" />
								<rect
									x={px}
									y={-h / 2}
									width={leaf.w}
									height={h}
									rx={h / 2}
									fill="#2dd4bf"
									fillOpacity="0.14"
									stroke="#5eead4"
									strokeOpacity="0.85"
								/>
							</g>
							<circle r={LEAF_R} fill="#0b1c1a" stroke="#2dd4bf" strokeOpacity="0.7" strokeWidth="1.2" />
							<rect
								x={px}
								y={-h / 2}
								width={leaf.w}
								height={h}
								rx={h / 2}
								fill="#0b1917"
								fillOpacity="0.9"
								stroke="#2dd4bf"
								strokeOpacity="0.24"
							/>
							<text
								x={px + leaf.w / 2}
								y="0.5"
								textAnchor="middle"
								dominantBaseline="central"
								fontSize={LEAF_FONT}
								fontWeight="500"
								fill="#cdeee9"
							>
								{leaf.label}
							</text>
						</g>
					);
				}),
			)}

			{l.nodes.map((p, i) => {
				const block = BLOCKS[i] as (typeof BLOCKS)[number];
				const lines = chipLines(ANSWERS[i] as string);
				const chipW = Math.round(Math.max(...lines.map((t) => t.length)) * 6.7 + 38);
				const chipH = 42;
				const cx = { r: 44, l: -44 - chipW, below: -chipW / 2, belowLeft: -36 - chipW, belowRight: 36 }[block.chip];
				const cy = { r: -chipH / 2, l: -chipH / 2, below: 63, belowLeft: 10, belowRight: 10 }[block.chip];
				return (
					<g key={superBot.dots[i]} className="sb-node" transform={`translate(${p.x} ${p.y})`}>
						<circle className="sb-lit-glow" r={l.nodeR * 1.7} fill={`url(#sb-glow-${uid})`} />
						<circle r={l.nodeR} fill="#101012" stroke="#fff" strokeOpacity="0.2" strokeWidth="1.5" />
						<circle
							className="sb-lit"
							r={l.nodeR}
							fill="#2dd4bf"
							fillOpacity="0.14"
							stroke="#2dd4bf"
							strokeWidth="2.5"
						/>
						<Icon
							as={DOT_ICONS[i] as LucideIcon}
							x={-l.nodeR * 0.42}
							y={-l.nodeR * 0.42}
							width={l.nodeR * 0.84}
							height={l.nodeR * 0.84}
							style={{ width: l.nodeR * 0.84, height: l.nodeR * 0.84 }}
							stroke="#f5f5f7"
							strokeWidth={1.75}
						/>
						<text
							x={l.chips ? block.name.x : 0}
							y={l.chips ? block.name.y : l.nodeR + 18}
							textAnchor={l.chips ? block.name.anchor : "middle"}
							dominantBaseline={l.chips ? "central" : undefined}
							fontSize={l.chips ? 14 : 12}
							fontWeight="600"
							fill="#a1a1a6"
						>
							{superBot.dots[i]}
						</text>
						{l.chips && (
							<g transform={`translate(${cx} ${cy})`}>
								<g className="sb-chip">
									<rect width={chipW} height={chipH} rx="14" fill="#0d1d1b" stroke="#2dd4bf" strokeOpacity="0.5" />
									<circle cx="14" cy={chipH / 2} r="3.5" fill="#2dd4bf" />
									{lines.map((t, n) => (
										<text
											key={t}
											x="26"
											y={chipH / 2 + (n - 0.5) * 15}
											dominantBaseline="central"
											fontSize="13"
											fontWeight="550"
											fill="#e8fffb"
										>
											{t}
										</text>
									))}
								</g>
							</g>
						)}
					</g>
				);
			})}

			{animated && (
				<>
					{l.nodes.map((_, i) => (
						<circle key={`ask-${superBot.dots[i]}`} className="sb-ask" r="5" fill="#5eead4" />
					))}
					{l.leaves.map((group, i) =>
						group.map((_, k) => (
							<circle key={`pulse-${superBot.dots[i]}-${k}`} className="sb-pulse" r="2.6" fill="#99f6e4" />
						)),
					)}
					{l.nodes.map((_, i) => (
						<circle key={`ans-${superBot.dots[i]}`} className="sb-ans" r="5" fill="#ffffff" />
					))}
				</>
			)}
		</svg>
	);
}

const srText = `SuperDot connects to ${superBot.dots.length} Dots: ${superBot.dots
	.map((d) => `${d} (${(superBot.capabilities[d] ?? []).join(", ")})`)
	.join("; ")}. Each Dot has its own abilities, and SuperDot asks them all at once.`;

export function SuperBot(): ReactNode {
	const section = useRef<HTMLElement>(null);
	const pin = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (prefersReducedMotion()) return;
			const mm = gsap.matchMedia();
			mm.add("(min-width: 900px)", () => {
				const q = gsap.utils.selector(section);
				const root = section.current;
				if (!root) return;
				const typed = root.querySelector<HTMLElement>(".sb-typed");
				const rest = root.querySelector<HTMLElement>(".sb-rest");
				const full = (typed?.textContent ?? "") + (rest?.textContent ?? "");
				const svg = root.querySelector<SVGSVGElement>(".sb-svg-d");
				if (!svg || !typed || !rest) return;

				const paths = Array.from(svg.querySelectorAll<SVGPathElement>(".sb-path"));
				const lits = Array.from(svg.querySelectorAll(".sb-lit"));
				const litGlows = Array.from(svg.querySelectorAll(".sb-lit-glow"));
				const chips = Array.from(svg.querySelectorAll(".sb-chip"));
				const nodes = Array.from(svg.querySelectorAll(".sb-node"));
				const asks = Array.from(svg.querySelectorAll<SVGCircleElement>(".sb-ask"));
				const lpaths = Array.from(svg.querySelectorAll<SVGPathElement>(".sb-lpath"));
				const leafEls = Array.from(svg.querySelectorAll(".sb-leaf"));
				const hots = Array.from(svg.querySelectorAll(".sb-leaf-hot"));
				const pulses = Array.from(svg.querySelectorAll<SVGCircleElement>(".sb-pulse"));
				const answers = Array.from(svg.querySelectorAll<SVGCircleElement>(".sb-ans"));
				const A = <T,>(a: T[], i: number) => a[i] as T;
				const lens = paths.map((p) => p.getTotalLength());
				const llens = lpaths.map((p) => p.getTotalLength());
				const LEAVES = lpaths.length / paths.length;

				gsap.set(q(".sb-diagram"), { opacity: 1, scale: 1 });
				gsap.set(q(".sb-win"), { opacity: 0, y: 160, scale: 0.94 });
				gsap.set(paths, { strokeDashoffset: 1 });
				gsap.set(lpaths, { strokeDashoffset: 1 });
				gsap.set(leafEls, { opacity: 0 });
				gsap.set(hots, { opacity: 0 });
				gsap.set(lits, { opacity: 0 });
				gsap.set(litGlows, { opacity: 0 });
				gsap.set(chips, { opacity: 0, y: 8 });
				gsap.set(nodes, { opacity: 0.55 });
				gsap.set(q(".sb-bubble"), { opacity: 1 });
				gsap.set(q(".sb-glow"), { opacity: 0.25, scale: 0.8 });

				const place = (el: SVGCircleElement, i: number, p: number) => {
					const pt = A(paths, i).getPointAtLength(p * A(lens, i));
					el.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
					el.style.opacity = String(Math.max(0, Math.min(1, p * 10, (1 - p) * 10)));
				};

				const placeLeaf = (el: SVGCircleElement, j: number, p: number) => {
					const pt = A(lpaths, j).getPointAtLength(p * A(llens, j));
					el.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
					el.style.opacity = String(Math.max(0, Math.min(1, p * 8, (1 - p) * 8)));
				};

				const tl = gsap.timeline({
					defaults: { ease: "none" },
					scrollTrigger: {
						trigger: section.current,
						start: "top top",
						end: () => `+=${window.innerHeight * 4}`,
						pin: pin.current,
						anticipatePin: 1,
						scrub: 0.8,
						invalidateOnRefresh: true,
					},
				});

				// Question types in at the start.
				const type = { n: 0 };
				tl.to(
					type,
					{
						n: full.length,
						duration: 1,
						onUpdate: () => {
							const n = Math.round(type.n);
							typed.textContent = full.slice(0, n);
							rest.textContent = full.slice(n);
						},
					},
					0,
				);
				tl.to(q(".sb-glow"), { opacity: 1, scale: 1.1, duration: 9 }, 0);

				// (1) connections draw
				tl.to(paths, { strokeDashoffset: 0, duration: 1.2, stagger: 0.18, ease: "power1.inOut" }, 1.2);

				paths.forEach((_, i) => {
					const ask = { p: 0 };
					const ans = { p: 1 };
					const t0 = 2.5 + i * 0.18;
					// (2) asking dots travel outward
					tl.to(ask, { p: 1, duration: 1.4, ease: "power1.inOut", onUpdate: () => place(A(asks, i), i, ask.p) }, t0);
					// (3) the Dot lights up as the question arrives
					tl.to(A(nodes, i), { opacity: 1, duration: 0.4 }, t0 + 1.2)
						.to(A(lits, i), { opacity: 1, duration: 0.4 }, t0 + 1.2)
						.to(A(litGlows, i), { opacity: 1, duration: 0.5 }, t0 + 1.2);

					// (3b) its capability branches grow, staggered per Dot; a pulse follows each one to its leaf
					const g = 3.9 + i * 0.3;
					for (let k = 0; k < LEAVES; k++) {
						const j = i * LEAVES + k;
						const pulse = { p: 0 };
						const t = g + k * 0.1;
						tl.to(A(lpaths, j), { strokeDashoffset: 0, duration: 0.9, ease: "power1.inOut" }, t)
							.to(
								pulse,
								{ p: 1, duration: 0.9, ease: "power1.inOut", onUpdate: () => placeLeaf(A(pulses, j), j, pulse.p) },
								t + 0.1,
							)
							.to(A(leafEls, j), { opacity: 1, duration: 0.4 }, t + 0.8)
							.to(A(hots, j), { opacity: 1, duration: 0.4 }, t + 0.9);
					}

					// (4) answer chip appears, the leaves dim a little, the answer flows back
					const c = g + 1.7;
					tl.to(A(chips, i), { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, c).to(
						hots.slice(i * LEAVES, (i + 1) * LEAVES),
						{ opacity: 0.22, duration: 0.7 },
						c,
					);
					const t1 = 6.9 + i * 0.18;
					tl.fromTo(
						ans,
						{ p: 1 },
						{
							p: 0,
							duration: 1.4,
							ease: "power1.inOut",
							immediateRender: false,
							onUpdate: () => place(A(answers, i), i, ans.p),
						},
						t1,
					);
				});
				tl.fromTo(
					q(".sb-core-glow"),
					{ scale: 1 },
					{ scale: 1.35, duration: 0.5, yoyo: true, repeat: 1, ease: "sine.inOut", transformOrigin: "50% 50%" },
					8.6,
				);

				// (5) diagram steps back, the answer window rises
				tl.to(q(".sb-diagram"), { opacity: 0, scale: 0.84, duration: 1, ease: "power2.in" }, 9.7)
					.to(q(".sb-win"), { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: "power3.out" }, 10.2)
					.to(q(".sb-glow"), { opacity: 0.7, duration: 1.2 }, 10.2)
					.to({}, { duration: 1 });

				return () => {
					typed.textContent = full;
					rest.textContent = "";
					for (const el of [...asks, ...answers, ...pulses]) {
						el.removeAttribute("transform");
						el.style.opacity = "";
					}
				};
			});
		},
		{ scope: section },
	);

	return (
		<section ref={section} id="superdot" className="chapter-dark sb-root">
			<div ref={pin} className="sb-pin">
				<div aria-hidden="true" className="sb-glow" />
				<div className="container-site relative flex min-h-0 flex-1 flex-col gap-[inherit]">
					<Reveal stagger={0.08} className="sb-head mx-auto flex max-w-3xl flex-col items-center text-center">
						<div>
							<p className="t-caption mb-4 uppercase tracking-[0.14em] text-accent">{superBot.eyebrow}</p>
							<h2 className="t-display-l">
								<span className="block">{superBot.h2[0]}</span>
								<span className="text-gradient block">{superBot.h2[1]}</span>
							</h2>
						</div>
						<p className="t-lead mt-5 max-w-xl text-fg-2 min-[900px]:mt-0">
							{superBot.lead}
							<LearnMore href="/features/superdot" label="Learn more about SuperDot" />
						</p>
					</Reveal>

					<div className="mt-10 flex justify-center min-[900px]:mt-0">
						<p className="sb-bubble">
							<span className="sb-typed">{superBot.question}</span>
							<span className="sb-rest" />
						</p>
					</div>

					<div className="sb-stage mt-8 min-[900px]:mt-0">
						<p className="sr-only">{srText}</p>
						<div className="sb-diagram">
							<div className="sb-mascot">
								<Mascot pose="conductor" size={120} />
							</div>
							<Diagram l={mobile} className="sb-svg-m" animated={false} />
							<Diagram l={desktop} className="sb-svg-d" animated />
						</div>

						<ul className="sb-list mx-auto mt-6 grid max-w-md gap-3">
							{superBot.dots.map((d, i) => (
								<li key={d} className="rounded-3xl border border-accent/30 bg-white/[0.04] px-4 py-3 text-fg">
									<p className="t-caption flex items-center gap-3">
										<Icon as={DOT_ICONS[i] as LucideIcon} size={18} className="shrink-0 text-accent" />
										<span className="font-semibold">{d}</span>
										<span className="ml-auto text-right text-fg-2">{ANSWERS[i]}</span>
									</p>
									<ul className="mt-2.5 flex flex-wrap gap-1.5">
										{(superBot.capabilities[d] ?? []).map((c) => (
											<li
												key={c}
												className="sb-cap rounded-full border border-accent/35 bg-accent/10 px-2.5 py-1 text-[0.75rem] leading-none text-fg"
											>
												{c}
											</li>
										))}
									</ul>
								</li>
							))}
						</ul>

						<MacWindow className="sb-win">
							<Screenshot
								name="superbot-answer"
								theme="dark"
								sizes="(min-width: 1000px) 1000px, 100vw"
								alt="SuperDot's combined answer, assembled from every Dot, with sources."
							/>
						</MacWindow>
					</div>
				</div>
			</div>
		</section>
	);
}
