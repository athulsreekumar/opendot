"use client";

import clsx from "clsx";
import { type ReactNode, useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { Calendar, Folder, Icon, Mail } from "@/components/ui/Icon";
import { MacWindow } from "@/components/ui/MacWindow";
import { Mascot } from "@/components/ui/Mascot";
import { Screenshot } from "@/components/ui/Screenshot";
import { createDot } from "@/lib/copy";

const SHOTS = [
	{ name: "new-dot-describe", alt: "The New Dot sheet with a plain-English description of what the Dot should do." },
	{ name: "new-dot-review", alt: "Reviewing the Dot's connectors and permissions before it is created." },
	{ name: "new-dot-created", alt: "The new Dot, named and styled by OpenDot, live in the sidebar." },
];
// TODO(copy): chip labels
const CHIPS = [
	{ label: "Gmail", icon: Mail, pos: "-left-6 top-[18%]" },
	{ label: "Calendar", icon: Calendar, pos: "-right-5 top-[46%]" },
	{ label: "Folder", icon: Folder, pos: "-left-4 bottom-[14%]" },
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number) => {
	const t = clamp(v);
	return t * t * (3 - 2 * t);
};
/** Three equal scroll segments; the step "snaps" over the last 30% of each segment. Returns 0..2. */
function stepPos(p: number) {
	const s = clamp(p) * 3;
	const seg = Math.min(2, Math.floor(s));
	if (seg === 2) return 2;
	return seg + smooth((s - seg - 0.7) / 0.3);
}

function Chip({ label, icon }: { label: string; icon: typeof Mail }) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[13px] font-medium text-fg shadow-card">
			<Icon as={icon} size={14} className="text-accent" />
			{label}
		</span>
	);
}

function Step({ i, title, body, className }: { i: number; title: string; body: string; className?: string }) {
	return (
		<div className={clsx("relative", className)}>
			<p className="t-caption mb-2 font-semibold tracking-wide text-accent">{String(i + 1).padStart(2, "0")}</p>
			<h3 className="t-title text-fg">{title}</h3>
			<p className="t-body mt-2 text-fg-2">{body}</p>
		</div>
	);
}

/** Chapter 3: Create a Dot. Desktop pin with a scrubbed three-step walkthrough; stacked everywhere else. */
export function CreateDot() {
	const section = useRef<HTMLElement>(null);
	const inner = useRef<HTMLDivElement>(null);
	const stepEls = useRef<(HTMLDivElement | null)[]>([]);
	const barEls = useRef<(HTMLSpanElement | null)[]>([]);
	const layers = useRef<(HTMLDivElement | null)[]>([]);
	const mascotWrap = useRef<HTMLDivElement>(null);
	const thinking = useRef<HTMLDivElement>(null);
	const cheer = useRef<HTMLDivElement>(null);
	const chipEls = useRef<(HTMLDivElement | null)[]>([]);

	useGSAP(
		() => {
			const mm = gsap.matchMedia();
			mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
				const chips = chipEls.current.filter(Boolean) as HTMLElement[];
				const wrap = mascotWrap.current;
				const thinkEl = thinking.current;
				const cheerEl = cheer.current;
				if (!wrap || !thinkEl || !cheerEl) return;

				// Initial states
				gsap.set(wrap, { yPercent: 62, autoAlpha: 0 });
				gsap.set(cheerEl, { autoAlpha: 0, scale: 0.9 });
				gsap.set(chips, { autoAlpha: 0, y: 14, scale: 0.9 });
				const floats = chips.map((c, i) =>
					gsap.to(c.firstElementChild, {
						y: i % 2 ? 5 : -5,
						duration: 2.2 + i * 0.3,
						ease: "sine.inOut",
						yoyo: true,
						repeat: -1,
						paused: true,
					}),
				);

				let step = -1;
				const enterStep = (n: number) => {
					step = n;
					if (n === 1) {
						gsap.killTweensOf([wrap, thinkEl, cheerEl]);
						gsap.set(thinkEl, { autoAlpha: 1 });
						gsap.set(cheerEl, { autoAlpha: 0 });
						gsap.to(wrap, { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: "back.out(1.5)" });
						gsap.killTweensOf(chips);
						gsap.to(chips, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.7)", stagger: 0.12 });
						for (const f of floats) f.play();
					} else if (n === 2) {
						gsap.killTweensOf([wrap, thinkEl, cheerEl]);
						gsap.set(wrap, { yPercent: 0, autoAlpha: 1 });
						gsap.set(thinkEl, { autoAlpha: 0 });
						gsap.fromTo(
							cheerEl,
							{ autoAlpha: 1, scale: 0.9 },
							{
								keyframes: [
									{ scale: 1.05, duration: 0.22, ease: "power2.out" },
									{ scale: 1, duration: 0.3, ease: "power2.inOut" },
								],
							},
						);
						gsap.killTweensOf(chips);
						gsap.to(chips, { autoAlpha: 0, y: -10, scale: 0.92, duration: 0.35, ease: "power2.in", stagger: 0.04 });
						for (const f of floats) f.pause();
					} else if (n === 0) {
						gsap.killTweensOf([wrap, cheerEl]);
						gsap.to(wrap, { yPercent: 62, autoAlpha: 0, duration: 0.45, ease: "power2.in" });
						gsap.killTweensOf(chips);
						gsap.to(chips, { autoAlpha: 0, y: 14, scale: 0.9, duration: 0.3 });
						for (const f of floats) f.pause();
					}
				};

				const apply = (p: number) => {
					const pos = stepPos(p);
					layers.current.forEach((el, i) => {
						if (!el) return;
						const d = pos - i;
						gsap.set(el, {
							opacity: clamp(1 - Math.abs(d)),
							scale: 1 - d * 0.035,
							yPercent: -d * 2.5,
							zIndex: d >= 0 ? 2 - i + 1 : 0,
						});
					});
					stepEls.current.forEach((el, i) => {
						if (!el) return;
						gsap.set(el, { opacity: 0.35 + 0.65 * clamp(1 - Math.abs(pos - i)) });
					});
					barEls.current.forEach((el, i) => {
						if (el) gsap.set(el, { scaleY: clamp(1 - Math.abs(pos - i)) });
					});
					const active = Math.round(pos);
					if (active !== step) enterStep(active);
				};

				apply(0);
				const st = gsap.timeline({
					scrollTrigger: {
						trigger: section.current,
						start: "top top",
						end: () => `+=${window.innerHeight * 3}`,
						pin: inner.current,
						anticipatePin: 1,
						scrub: 0.6,
						invalidateOnRefresh: true,
						onUpdate: (self) => apply(self.progress),
					},
				});
				st.to({}, { duration: 1 });

				return () => {
					for (const f of floats) f.kill();
				};
			});
		},
		{ scope: section },
	);

	const header: ReactNode = (
		<div className="text-center">
			<Reveal as="p" className="t-caption font-semibold uppercase tracking-[0.14em] text-accent">
				{createDot.eyebrow}
			</Reveal>
			<Reveal as="h2" delay={0.06} className="t-display-l mt-4">
				<span className="block">{createDot.h2[0]}</span>
				<span className="text-gradient block pb-[0.08em]">{createDot.h2[1]}</span>
			</Reveal>
		</div>
	);

	return (
		<section ref={section} id="create" className="chapter-light bg-bg text-fg">
			<div ref={inner} className="flex min-h-svh flex-col justify-center py-24 min-[900px]:motion-safe:py-16">
				<div className="container-site">
					{header}

					{/* Desktop, motion allowed: pinned two-column walkthrough. */}
					<div className="mt-10 hidden grid-cols-[5fr_7fr] items-center gap-14 min-[900px]:motion-safe:grid lg:mt-14">
						<div className="flex flex-col gap-9">
							{createDot.steps.map((s, i) => (
								<div
									key={s.title}
									ref={(el) => {
										stepEls.current[i] = el;
									}}
									className="relative pl-6"
									style={{ opacity: i === 0 ? 1 : 0.35 }}
								>
									<span
										ref={(el) => {
											barEls.current[i] = el;
										}}
										aria-hidden="true"
										className="absolute inset-y-1 left-0 w-0.5 origin-top rounded-full bg-accent"
										style={{ transform: `scaleY(${i === 0 ? 1 : 0})` }}
									/>
									<Step i={i} title={s.title} body={s.body} />
								</div>
							))}
						</div>

						<div className="relative mx-auto w-full max-w-[720px]">
							{/* Odi peeks from behind the window's top-right corner. */}
							<div
								ref={mascotWrap}
								className="pointer-events-none absolute -top-[88px] right-6 z-0 h-[140px] w-[140px]"
							>
								<div ref={thinking} className="absolute inset-0">
									<Mascot pose="thinking" size={140} />
								</div>
								<div ref={cheer} className="absolute inset-0">
									<Mascot pose="cheer" size={140} />
								</div>
							</div>
							<div className="relative z-10">
								<MacWindow>
									<div className="relative">
										{SHOTS.map((s, i) => (
											<div
												key={s.name}
												ref={(el) => {
													layers.current[i] = el;
												}}
												className="absolute inset-0"
												style={{ opacity: i === 0 ? 1 : 0 }}
											>
												<Screenshot name={s.name} alt={s.alt} theme="light" sizes="(min-width: 900px) 720px, 100vw" />
											</div>
										))}
									</div>
								</MacWindow>
								{CHIPS.map((c, i) => (
									<div
										key={c.label}
										ref={(el) => {
											chipEls.current[i] = el;
										}}
										className={clsx("absolute z-20", c.pos)}
										style={{ visibility: "hidden" }}
									>
										<div>
											<Chip label={c.label} icon={c.icon} />
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Mobile / reduced motion: each step followed by its screenshot. */}
					<div className="mx-auto mt-12 flex max-w-[640px] flex-col gap-14 min-[900px]:motion-safe:hidden">
						{createDot.steps.map((s, i) => (
							<Reveal key={s.title} className="flex flex-col gap-6">
								{i === 2 ? (
									<div className="flex items-end justify-between gap-4">
										<Step i={i} title={s.title} body={s.body} />
										<Mascot pose="cheer" size={110} className="-mb-2 shrink-0" />
									</div>
								) : (
									<Step i={i} title={s.title} body={s.body} />
								)}
								<div className="relative">
									<MacWindow>
										<Screenshot
											name={SHOTS[i]?.name ?? ""}
											alt={SHOTS[i]?.alt ?? ""}
											theme="light"
											sizes="(min-width: 640px) 640px, 100vw"
										/>
									</MacWindow>
								</div>
							</Reveal>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
