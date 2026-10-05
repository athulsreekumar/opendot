"use client";

import clsx from "clsx";
import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { Calendar, FileText, Icon, Mail } from "@/components/ui/Icon";
import { MacWindow } from "@/components/ui/MacWindow";
import { Mascot } from "@/components/ui/Mascot";
import { Screenshot } from "@/components/ui/Screenshot";
import { alwaysOn } from "@/lib/copy";
import "./AlwaysOn.css";

const SOURCE_ICON = [
	{ icon: Mail, bg: "linear-gradient(160deg,#60a5fa,#2563eb)" },
	{ icon: Calendar, bg: "linear-gradient(160deg,#fb7185,#e11d48)" },
	{ icon: FileText, bg: "linear-gradient(160deg,#fbbf24,#d97706)" },
];

// Approximate sidebar Dot-row positions in "sidebar-full" (fractions of the window box).
const ROW_X = 0.1;
const ROW_Y = (i: number) => 0.26 + i * 0.1;

const badgeStyle = [
	"border-[#ff6b5e]/40 bg-[#ff6b5e]/15 text-[#ff8a7a]",
	"border-accent/40 bg-accent/15 text-accent",
	"border-line bg-white/[0.06] text-fg-2",
];

export function AlwaysOn() {
	const section = useRef<HTMLElement>(null);
	const pin = useRef<HTMLDivElement>(null);
	const stage = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (prefersReducedMotion()) return;
			const mm = gsap.matchMedia();
			mm.add("(min-width: 900px)", () => {
				const q = gsap.utils.selector(section);
				const cards = q(".ao-card");
				const pulses = q(".ao-pulse");
				const W = () => stage.current?.offsetWidth ?? 800;
				const H = () => stage.current?.offsetHeight ?? 500;
				const vw = () => window.innerWidth;

				gsap.set(cards, { xPercent: -50, yPercent: -50, opacity: 0 });
				gsap.set(q(".ao-update"), { opacity: 0 });
				gsap.set(q(".ao-badge"), { opacity: 0, y: 14, scale: 0.94 });
				gsap.set(q(".ao-moon"), { opacity: 0.45 });
				gsap.set(pulses, { opacity: 0 });

				const tl = gsap.timeline({
					defaults: { ease: "none" },
					scrollTrigger: {
						trigger: section.current,
						start: "top top",
						end: () => `+=${window.innerHeight * 2.5}`,
						pin: pin.current,
						anticipatePin: 1,
						scrub: 0.8,
						invalidateOnRefresh: true,
					},
				});

				cards.forEach((card, i) => {
					const t = 0.3 + i * 2.5;
					const landX = () => W() * 0.5 - 150;
					const landY = () => -H() * 0.5 + 80;
					const tx = () => -W() * 0.5 + W() * ROW_X;
					const ty = () => -H() * 0.5 + H() * ROW_Y(i);
					tl.fromTo(
						card,
						{ x: () => vw() * 0.5, y: landY, opacity: 0, scale: 1 },
						{ x: landX, y: landY, opacity: 1, duration: 0.8, ease: "power3.out", immediateRender: false },
						t,
					)
						.to(card, { x: tx, y: ty, scale: 0.28, opacity: 0, duration: 0.9, ease: "power2.inOut" }, t + 1.2)
						.fromTo(
							pulses[i] as Element,
							{ x: tx, y: ty, scale: 0.3, opacity: 0 },
							{ scale: 1.8, opacity: 0.95, duration: 0.35, ease: "power2.out", immediateRender: false },
							t + 2.0,
						)
						.to(pulses[i] as Element, { scale: 2.6, opacity: 0.35, duration: 0.5, ease: "power1.out" }, t + 2.35);
				});

				const end = 0.3 + 3 * 2.5;
				tl.to(q(".ao-update"), { opacity: 1, duration: 0.9, ease: "power1.inOut" }, end)
					.to(pulses, { opacity: 0, duration: 0.6 }, end)
					.to(
						q(".ao-badge"),
						{ opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.25, ease: "back.out(1.5)" },
						end + 0.7,
					)
					.to(q(".ao-moon"), { opacity: 1, duration: 1.2 }, end)
					.to({}, { duration: 1.2 });
			});
		},
		{ scope: section },
	);

	return (
		<section ref={section} id="always-on" className="chapter-dark ao-root">
			<div ref={pin} className="ao-pin">
				<div className="container-site">
					<Reveal stagger={0.08} className="mx-auto flex max-w-5xl flex-col items-center text-center">
						<p className="t-caption mb-4 uppercase tracking-[0.14em] text-accent">{alwaysOn.eyebrow}</p>
						<h2 className="t-display-l">{alwaysOn.h2[0]}</h2>
						<p className="t-lead mt-5 max-w-2xl text-fg-2">{alwaysOn.lead}</p>
					</Reveal>
				</div>

				<div className="ao-body container-site relative">
					<div ref={stage} className="ao-stage mx-auto max-w-[1000px]">
						<div className="ao-cards">
							{alwaysOn.events.map((e, i) => {
								const s = SOURCE_ICON[i] as (typeof SOURCE_ICON)[number];
								return (
									<div key={e.title} className="ao-card">
										<span
											className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white"
											style={{ background: s.bg }}
										>
											<Icon as={s.icon} size={20} />
										</span>
										<span className="min-w-0 flex-1">
											<span className="flex items-baseline justify-between gap-3">
												<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-2">
													{e.source}
												</span>
												<span className="text-[11px] text-fg-3">now</span>
											</span>
											<span className="mt-0.5 block text-[13.5px] font-medium leading-snug text-fg">{e.title}</span>
										</span>
									</div>
								);
							})}
							{alwaysOn.events.map((e) => (
								<span key={e.dot} className="ao-pulse" aria-hidden="true" />
							))}
						</div>

						<MacWindow>
							<div className="relative size-full">
								<Screenshot
									name="sidebar-full"
									theme="dark"
									sizes="(min-width: 1000px) 1000px, 100vw"
									alt="The OpenDot sidebar with all your Dots listed."
								/>
								<div className="ao-update">
									<Screenshot
										name="always-on-update"
										theme="dark"
										sizes="(min-width: 1000px) 1000px, 100vw"
										alt="A Dot flags an urgent reply and posts a quiet update in the OpenDot app."
									/>
								</div>
							</div>
						</MacWindow>
					</div>

					<ul className="mx-auto ao-badges mt-8 flex flex-wrap items-center justify-center gap-3">
						{alwaysOn.badges.map((b, i) => (
							<li
								key={b}
								className={clsx(
									"ao-badge t-caption rounded-full border px-4 py-1.5 font-semibold tracking-wide",
									badgeStyle[i],
								)}
							>
								{b}
							</li>
						))}
					</ul>

					<div className="mt-10 flex flex-col items-center gap-3 text-center min-[900px]:absolute min-[900px]:bottom-0 min-[900px]:left-[var(--gutter)] min-[900px]:mt-0 min-[900px]:w-52 min-[900px]:items-start min-[900px]:text-left">
						<div className="relative size-[160px]">
							<div aria-hidden="true" className="ao-moon absolute -inset-10 rounded-full blur-2xl" />
							<Mascot pose="night" size={160} className="relative" />
						</div>
						<p className="t-caption text-fg-3">{alwaysOn.footnote}</p>
					</div>
				</div>
			</div>
		</section>
	);
}
