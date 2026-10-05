"use client";

import { type ReactNode, useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { MacWindow } from "@/components/ui/MacWindow";
import { Mascot } from "@/components/ui/Mascot";
import { Screenshot } from "@/components/ui/Screenshot";
import { superBot } from "@/lib/copy";
import "./SuperBot.css";

const EMOJI = ["📬", "📅", "🔎", "💸", "✈️"];
// TODO(copy): answer snippets (one per Dot, same order as superBot.dots)
const ANSWERS = [
	"2 emails need replies",
	"Board sync 9:30",
	"3 notes on Northwind",
	"Invoice due Friday",
	"Flight on time",
];

type Pt = { x: number; y: number };
type Layout = { w: number; h: number; core: Pt; coreR: number; nodeR: number; nodes: Pt[]; chips: boolean };

const desktop: Layout = (() => {
	const core = { x: 500, y: 220 };
	const nodes = [-90, -18, 54, 126, 198].map((a) => ({
		x: core.x + 290 * Math.cos((a * Math.PI) / 180),
		y: core.y + 160 * Math.sin((a * Math.PI) / 180),
	}));
	return { w: 1000, h: 440, core, coreR: 46, nodeR: 30, nodes, chips: true };
})();

const mobile: Layout = {
	w: 360,
	h: 340,
	core: { x: 180, y: 62 },
	coreR: 40,
	nodeR: 26,
	nodes: [0, 1, 2, 3, 4].map((i) => ({ x: 36 + i * 72, y: 240 })),
	chips: false,
};

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
	const r = (n: number) => n.toFixed(1);
	return `M${r(s.x)} ${r(s.y)}C${r(s.x + dx * 0.35 + nx)} ${r(s.y + dy * 0.35 + ny)} ${r(e.x - dx * 0.35 + nx)} ${r(e.y - dy * 0.35 + ny)} ${r(e.x)} ${r(e.y)}`;
}

function Diagram({ l, className, animated }: { l: Layout; className: string; animated: boolean }) {
	const uid = animated ? "d" : "m";
	const f = l.chips ? 1 : 0.9;
	return (
		<svg
			className={className}
			viewBox={`0 0 ${l.w} ${l.h}`}
			preserveAspectRatio="xMidYMid meet"
			role="img"
			aria-label={`SuperBot connected to ${superBot.dots.join(", ")}.`}
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
				<text y={-3} textAnchor="middle" fontSize={26 * f} dominantBaseline="middle">
					✨
				</text>
				<text y={l.coreR * 0.5} textAnchor="middle" fontSize={13 * f} fontWeight="650" fill="#f5f5f7">
					SuperBot
				</text>
			</g>

			{l.nodes.map((p, i) => {
				const top = l.chips && i === 0;
				const right = p.x >= l.core.x;
				const chipW = 172;
				const chipX = right ? 42 : -42 - chipW;
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
						<text textAnchor="middle" dominantBaseline="central" fontSize={l.nodeR * 0.85}>
							{EMOJI[i]}
						</text>
						<text
							y={top ? -l.nodeR - 14 : l.nodeR + (l.chips ? 20 : 18)}
							textAnchor="middle"
							fontSize={l.chips ? 13 : 12}
							fontWeight="600"
							fill="#a1a1a6"
						>
							{superBot.dots[i]}
						</text>
						{l.chips && (
							<g className="sb-chip" transform={`translate(${chipX} -15)`}>
								<rect width={chipW} height="30" rx="15" fill="#0d1d1b" stroke="#2dd4bf" strokeOpacity="0.5" />
								<circle cx="16" cy="15" r="3.5" fill="#2dd4bf" />
								<text x="28" y="15" dominantBaseline="central" fontSize="12" fontWeight="550" fill="#e8fffb">
									{ANSWERS[i]}
								</text>
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
					{l.nodes.map((_, i) => (
						<circle key={`ans-${superBot.dots[i]}`} className="sb-ans" r="5" fill="#ffffff" />
					))}
				</>
			)}
		</svg>
	);
}

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
				const answers = Array.from(svg.querySelectorAll<SVGCircleElement>(".sb-ans"));
				const A = <T,>(a: T[], i: number) => a[i] as T;
				const lens = paths.map((p) => p.getTotalLength());

				gsap.set(q(".sb-diagram"), { opacity: 1, scale: 1 });
				gsap.set(q(".sb-win"), { opacity: 0, y: 160, scale: 0.94 });
				gsap.set(paths, { strokeDashoffset: 1 });
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

				const tl = gsap.timeline({
					defaults: { ease: "none" },
					scrollTrigger: {
						trigger: section.current,
						start: "top top",
						end: () => `+=${window.innerHeight * 3}`,
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
				tl.to(q(".sb-glow"), { opacity: 1, scale: 1.1, duration: 7 }, 0);

				// (1) connections draw
				tl.to(paths, { strokeDashoffset: 0, duration: 1.2, stagger: 0.18, ease: "power1.inOut" }, 1.2);

				paths.forEach((_, i) => {
					const ask = { p: 0 };
					const ans = { p: 1 };
					const t0 = 2.5 + i * 0.18;
					// (2) asking dots travel outward
					tl.to(ask, { p: 1, duration: 1.4, ease: "power1.inOut", onUpdate: () => place(A(asks, i), i, ask.p) }, t0);
					// (3) node lights up, answer chip appears
					tl.to(A(nodes, i), { opacity: 1, duration: 0.4 }, t0 + 1.2)
						.to(A(lits, i), { opacity: 1, duration: 0.4 }, t0 + 1.2)
						.to(A(litGlows, i), { opacity: 1, duration: 0.5 }, t0 + 1.2)
						.to(A(chips, i), { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, t0 + 1.4);
					// (4) answers flow back
					const t1 = 5.2 + i * 0.18;
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
					6.9,
				);

				// (5) diagram steps back, the answer window rises
				tl.to(q(".sb-diagram"), { opacity: 0, scale: 0.84, duration: 1, ease: "power2.in" }, 8)
					.to(q(".sb-win"), { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: "power3.out" }, 8.5)
					.to(q(".sb-glow"), { opacity: 0.7, duration: 1.2 }, 8.5)
					.to({}, { duration: 1 });

				return () => {
					typed.textContent = full;
					rest.textContent = "";
					for (const el of [...asks, ...answers]) {
						el.removeAttribute("transform");
						el.style.opacity = "";
					}
				};
			});
		},
		{ scope: section },
	);

	return (
		<section ref={section} id="superbot" className="chapter-dark">
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
						<p className="t-lead mt-5 max-w-xl text-fg-2 min-[900px]:mt-0">{superBot.lead}</p>
					</Reveal>

					<div className="mt-10 flex justify-center min-[900px]:mt-0">
						<p className="sb-bubble">
							<span className="sb-typed">{superBot.question}</span>
							<span className="sb-rest" />
						</p>
					</div>

					<div className="sb-stage mt-8 min-[900px]:mt-0">
						<div className="sb-diagram">
							<div className="sb-mascot">
								<Mascot pose="conductor" size={150} />
							</div>
							<Diagram l={mobile} className="sb-svg-m" animated={false} />
							<Diagram l={desktop} className="sb-svg-d" animated />
						</div>

						<ul className="sb-list mx-auto mt-6 grid max-w-sm gap-2">
							{superBot.dots.map((d, i) => (
								<li
									key={d}
									className="t-caption flex items-center gap-3 rounded-full border border-accent/30 bg-white/[0.04] px-4 py-2 text-fg"
								>
									<span aria-hidden="true">{EMOJI[i]}</span>
									<span className="font-semibold">{d}</span>
									<span className="ml-auto text-fg-2">{ANSWERS[i]}</span>
								</li>
							))}
						</ul>

						<MacWindow className="sb-win">
							<Screenshot
								name="superbot-answer"
								theme="dark"
								sizes="(min-width: 1000px) 1000px, 100vw"
								alt="SuperBot's combined answer, assembled from every Dot, with sources."
							/>
						</MacWindow>
					</div>
				</div>
			</div>
		</section>
	);
}
