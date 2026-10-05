"use client";

import clsx from "clsx";
import { Clock } from "lucide-react";
import { Fragment, useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { Icon } from "@/components/ui/Icon";
import { MacWindow } from "@/components/ui/MacWindow";
import { Screenshot } from "@/components/ui/Screenshot";
import { dotLinks } from "@/lib/copy";

type Perm = "allow" | "ask" | "block" | "self";

const DOTS = [
	{ id: "inbox", emoji: "📬", name: "Inbox" },
	{ id: "calendar", emoji: "📅", name: "Calendar" },
	{ id: "travel", emoji: "✈️", name: "Travel" },
	{ id: "money", emoji: "💸", name: "Money" },
] as const;

// rows = the Dot that asks, columns = the Dot that is asked.
const MATRIX: Perm[][] = [
	["self", "allow", "block", "ask"],
	["allow", "self", "allow", "block"],
	["ask", "ask", "self", "block"],
	["block", "allow", "block", "self"],
];
const HIGHLIGHT = { row: 2, col: 1 };

const CHIP: Record<Perm, { label: string; cls: string }> = {
	allow: { label: "Allow", cls: "bg-[#0e9f8a]/15 text-[#0b7f70] ring-[#0e9f8a]/30" },
	ask: { label: "Ask", cls: "bg-[#f5a524]/18 text-[#a15c00] ring-[#f5a524]/40" },
	block: { label: "Block", cls: "bg-black/[0.05] text-fg-3 ring-black/10 line-through decoration-fg-3/60" },
	self: { label: "·", cls: "text-fg-3" },
};

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function DotLinks() {
	const root = useRef<HTMLElement>(null);
	const card = useRef<HTMLDivElement>(null);
	const shot = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (prefersReducedMotion()) return;
			const chips = gsap.utils.toArray<HTMLElement>("[data-chip]", card.current);
			const callout = card.current?.querySelector("[data-callout]");
			gsap.set(chips, { rotateX: -90, opacity: 0, transformPerspective: 600, transformOrigin: "50% 50%" });
			if (callout) gsap.set(callout, { opacity: 0, y: 14 });
			const tl = gsap.timeline({
				scrollTrigger: { trigger: card.current, start: "top 75%", once: true },
			});
			tl.to(chips, {
				rotateX: 0,
				opacity: 1,
				duration: 0.7,
				ease: "back.out(1.4)",
				stagger: { each: 0.045, from: "start" },
			});
			if (callout) tl.to(callout, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" }, "-=0.3");

			gsap.fromTo(
				shot.current,
				{ y: 80, scale: 0.96, opacity: 0.4 },
				{
					y: 0,
					scale: 1,
					opacity: 1,
					ease: "none",
					scrollTrigger: { trigger: shot.current, start: "top 105%", end: "top 45%", scrub: 0.8 },
				},
			);
		},
		{ scope: root },
	);

	return (
		<section ref={root} id="links" className="chapter-light section-pad bg-bg text-fg">
			<div className="container-site">
				<div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
					<Reveal stagger={0.08}>
						<p className="t-caption font-semibold uppercase tracking-[0.14em] text-accent">{dotLinks.eyebrow}</p>
						<h2 className="t-display-l mt-4 max-w-[14ch]">{dotLinks.h2.join(" ")}</h2>
						<p className="t-lead mt-6 max-w-[34rem] text-fg-2">{dotLinks.lead}</p>
					</Reveal>

					<div ref={card} className="rounded-[var(--radius-lg)] bg-card p-4 shadow-card ring-1 ring-line sm:p-7">
						<p className="sr-only">
							Permission matrix. Rows are the Dot that asks, columns the Dot that is asked. Travel to Calendar: ask,
							weekdays only, five times an hour.
						</p>
						<div
							aria-hidden="true"
							className="grid grid-cols-[minmax(52px,0.9fr)_repeat(4,minmax(0,1fr))] items-center gap-x-1.5 gap-y-2 sm:gap-x-2 sm:gap-y-2.5"
						>
							<div className="text-[9px] font-medium uppercase leading-tight tracking-wider text-fg-3 sm:text-[10px]">
								asks ↓<br />
								<span className="opacity-70">replies →</span>
							</div>
							{DOTS.map((d) => (
								<div key={d.id} className="text-center">
									<div className="text-xl sm:text-2xl" aria-hidden="true">
										{d.emoji}
									</div>
									<div className="mt-0.5 truncate text-[10px] font-medium text-fg-2 sm:text-xs">{d.name}</div>
								</div>
							))}
							{DOTS.map((rowDot, r) => (
								<Fragment key={rowDot.id}>
									<div className="flex items-center gap-1 sm:gap-2">
										<span className="text-lg sm:text-xl" aria-hidden="true">
											{rowDot.emoji}
										</span>
										<span className="sr-only sm:not-sr-only sm:truncate sm:text-xs sm:font-medium sm:text-fg-2">
											{rowDot.name}
										</span>
									</div>
									{DOTS.map((colDot, c) => {
										const perm = MATRIX[r]?.[c] ?? "self";
										const hot = r === HIGHLIGHT.row && c === HIGHLIGHT.col;
										return (
											<div key={colDot.id} className="flex justify-center">
												<span
													data-chip
													className={clsx(
														"inline-flex h-6 w-full max-w-[64px] items-center justify-center rounded-full text-[10px] font-semibold sm:h-7 sm:text-xs",
														perm !== "self" && "ring-1 ring-inset",
														CHIP[perm].cls,
														hot && "ring-2 ring-[#f5a524] shadow-[0_0_0_4px_rgba(245,165,36,0.18)]",
													)}
												>
													{CHIP[perm].label}
												</span>
											</div>
										);
									})}
								</Fragment>
							))}
						</div>

						<div
							data-callout
							className="mt-6 rounded-[var(--radius)] border border-[#f5a524]/40 bg-[#fff8ea] p-4 text-[#1d1d1f] sm:p-5"
						>
							<div className="flex items-center gap-3">
								<span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f5a524]/25 text-[#a15c00]">
									<Icon as={Clock} size={18} />
								</span>
								<div className="min-w-0">
									<p className="text-sm font-semibold">✈️ Travel → 📅 Calendar</p>
									<p className="text-[13px] text-[#6e6e73]">Ask · weekdays · 5/hour</p>
								</div>
							</div>
							<div className="mt-4 flex gap-1.5" role="img" aria-label="Allowed Monday to Friday">
								{DAYS.map((d, i) => (
									<span
										key={i}
										className={clsx(
											"grid h-7 flex-1 place-items-center rounded-md text-[11px] font-semibold",
											i < 5 ? "bg-[#0e9f8a] text-white" : "bg-black/[0.06] text-[#86868b]",
										)}
									>
										{d}
									</span>
								))}
							</div>
						</div>
					</div>
				</div>

				<div ref={shot} className="mx-auto mt-16 max-w-[1100px] will-change-transform sm:mt-24">
					<MacWindow radius={12}>
						<Screenshot
							name="links-screen"
							theme="light"
							alt="OpenDot's Dot Links settings showing which Dots may message each other, with allow, ask and block rules"
							sizes="(min-width: 1200px) 1100px, 92vw"
						/>
					</MacWindow>
				</div>
			</div>
		</section>
	);
}
