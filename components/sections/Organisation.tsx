"use client";

import { type ReactNode, useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { DeptIcon } from "@/components/ui/DeptIcon";
import { GitHubButton } from "@/components/ui/GitHubButton";
import { Check, Icon, Pause, Shield } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { organisation as org, orgDepartments } from "@/lib/copy";
import "./Organisation.css";
import { LearnMore } from "./LearnMore";
import { AskArt, beatText, DoneArt, PlanArt, ReviewArt, Shot, SplitArt, SplitList } from "./OrganisationArt";

const L = 10; // timeline units per beat
const BEAT_COUNT = org.beats.length;
const STAGE_W = 1120;
const STAGE_H = 600;
const MAX_SCALE = 1.15;

/** The right-hand side of each beat: the real app screenshots. */
function beatShots(id: string): ReactNode {
	switch (id) {
		case "ask":
			return <Shot name="org-chat" theme="dark" alt={org.shots.chat} caption={org.inApp} />;
		case "plan":
			return <Shot name="org-plan" theme="dark" alt={org.shots.plan} caption={org.inApp} />;
		case "review":
			return <Shot name="org-drawer" theme="dark" alt={org.shots.drawer} caption={org.inApp} />;
		case "done":
			return (
				<div className="org-pair">
					<Shot name="org-board" theme="dark" alt={org.shots.board} className="org-shot-main" />
					<Shot name="org-summary" theme="dark" alt={org.shots.summary} className="org-shot-front" />
				</div>
			);
		default:
			return <SplitArt />;
	}
}

function beatArt(id: string): ReactNode {
	switch (id) {
		case "ask":
			return <AskArt />;
		case "plan":
			return <PlanArt />;
		case "split":
			return <SplitList />;
		case "review":
			return <ReviewArt />;
		default:
			return <DoneArt />;
	}
}

/** The pinned, scroll-driven storyboard. Stacked and static on phones and under reduced motion. */
function Story() {
	const section = useRef<HTMLElement>(null);
	const pin = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			const mm = gsap.matchMedia();
			mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
				const root = section.current;
				const pinEl = pin.current;
				if (!root || !pinEl) return;
				const view = root.querySelector<HTMLElement>(".org-view");
				const stage = root.querySelector<HTMLElement>(".org-beats");
				const beats = Array.from(root.querySelectorAll<HTMLElement>(".org-beat"));
				const steps = Array.from(root.querySelectorAll<HTMLElement>(".org-step"));
				const fill = root.querySelector<HTMLElement>(".org-rail-fill");
				const typed = root.querySelector<HTMLElement>(".org-ask-typed");
				const rest = root.querySelector<HTMLElement>(".org-ask-rest");
				if (!view || !stage || !fill || !typed || !rest || beats.length !== BEAT_COUNT) return;

				// Fit the fixed-size stage into the space the pin leaves (never above 1x).
				const rescale = () => {
					const s = Math.min(MAX_SCALE, view.clientWidth / STAGE_W, view.clientHeight / STAGE_H);
					stage.style.setProperty("--org-s", s.toFixed(3));
				};
				rescale();
				const ro = new ResizeObserver(rescale);
				ro.observe(view);

				const full = (typed.textContent ?? "") + (rest.textContent ?? "");
				const sel = (i: number) => gsap.utils.selector(beats[i] as HTMLElement);

				gsap.set(beats, { opacity: 0 });
				gsap.set(beats[0] as HTMLElement, { opacity: 1 });

				const tl = gsap.timeline({
					defaults: { ease: "none" },
					scrollTrigger: {
						trigger: pinEl,
						start: "top top",
						end: () => `+=${window.innerHeight * 5.5}`,
						pin: pinEl,
						anticipatePin: 1,
						scrub: 0.8,
						invalidateOnRefresh: true,
					},
					onUpdate: () => {
						const k = Math.min(BEAT_COUNT - 1, Math.max(0, Math.floor((tl.time() + 0.5) / L)));
						if (root.dataset.beat === String(k)) return;
						root.dataset.beat = String(k);
						steps.forEach((el, i) => {
							el.classList.toggle("is-on", i === k);
							el.classList.toggle("is-past", i < k);
						});
					},
				});

				// Rail progress and beat hand-over (fade out, fade in).
				tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: BEAT_COUNT * L }, 0);
				beats.forEach((b, k) => {
					if (k > 0) {
						tl.fromTo(
							b,
							{ opacity: 0, y: 28 },
							{ opacity: 1, y: 0, duration: 0.7, ease: "power2.out", immediateRender: false },
							k * L - 0.5,
						);
					}
					if (k < BEAT_COUNT - 1) {
						tl.to(b, { opacity: 0, y: -28, duration: 0.6, ease: "power2.in" }, (k + 1) * L - 1.2);
					}
				});

				// 1. Ask: the request is typed, SuperDot thinks, replies, and the plan-ready card lands.
				{
					const s = sel(0);
					const type = { n: 0 };
					typed.textContent = "";
					rest.textContent = full;
					tl.to(
						type,
						{
							n: full.length,
							duration: 2.2,
							onUpdate: () => {
								const n = Math.round(type.n);
								typed.textContent = full.slice(0, n);
								rest.textContent = full.slice(n);
							},
						},
						0.3,
					)
						.fromTo(
							s(".org-right"),
							{ opacity: 0, x: 60, scale: 0.95 },
							{ opacity: 1, x: 0, scale: 1, duration: 1.4, ease: "power2.out" },
							0.8,
						)
						.fromTo(s(".org-think"), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4 }, 2.7)
						.to(s(".org-think"), { opacity: 0, duration: 0.3 }, 3.7)
						.fromTo(
							s(".org-reply"),
							{ opacity: 0, y: 10 },
							{ opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
							3.8,
						)
						.fromTo(
							s(".org-update"),
							{ opacity: 0, y: 14, scale: 0.97 },
							{ opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.4)" },
							5,
						);
				}

				// 2. Plan: rows arrive, dependency lines draw, reviewers appear, the plan is approved.
				{
					const s = sel(1);
					const b = 1 * L;
					tl.fromTo(
						s(".org-plan-card"),
						{ opacity: 0, y: 30 },
						{ opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
						b + 0.3,
					)
						.fromTo(
							s(".org-right"),
							{ opacity: 0, x: 60, scale: 0.95 },
							{ opacity: 1, x: 0, scale: 1, duration: 1.4, ease: "power2.out" },
							b + 0.4,
						)
						.fromTo(
							s(".org-task"),
							{ opacity: 0, x: -16 },
							{ opacity: 1, x: 0, duration: 0.5, stagger: 0.45, ease: "power2.out" },
							b + 0.4,
						)
						.fromTo(
							s(".org-dep"),
							{ strokeDashoffset: 1 },
							{ strokeDashoffset: 0, duration: 0.9, stagger: 0.2, ease: "power1.inOut" },
							b + 2.4,
						)
						.fromTo(
							s(".org-rev"),
							{ opacity: 0, scale: 0.85 },
							{ opacity: 1, scale: 1, duration: 0.5, stagger: 0.2, ease: "back.out(1.6)" },
							b + 2.6,
						)
						.to(
							s(".org-btn-primary"),
							{ scale: 1.07, duration: 0.35, yoyo: true, repeat: 1, ease: "sine.inOut" },
							b + 5.6,
						)
						.to(s(".org-btn-primary"), { scale: 0.94, duration: 0.15, yoyo: true, repeat: 1 }, b + 6.7)
						.to(s(".org-state-wait"), { opacity: 0, duration: 0.3 }, b + 6.8)
						.to(s(".org-state-run"), { opacity: 1, duration: 0.3 }, b + 6.8);
				}

				// 3. Split: task chips fly to the departments, which light up and tick off in parallel.
				{
					const s = sel(2);
					const b = 2 * L;
					const node = (name: string) => s(`.org-node[data-node="${name}"]`)[0] as HTMLElement;
					const pos = (name: string) => {
						const el = node(name);
						return { left: `${el.dataset.x}%`, top: `${el.dataset.y}%` };
					};
					const fly = (task: string) => s(`.org-fly[data-task="${task}"]`)[0] as HTMLElement;
					const parts = (name: string) => {
						const el = node(name);
						return {
							el,
							lit: el.querySelector(".org-node-lit"),
							work: el.querySelector(".org-badge-work"),
							review: el.querySelector(".org-badge-review"),
							done: el.querySelector(".org-badge-done"),
						};
					};
					const stat = (task: number, seq: [number, "working" | "review" | "done"][]) => {
						const row = s(`.org-srow[data-task="${task}"]`)[0] as HTMLElement;
						const layer = (k: string) => row.querySelector(`.org-stat-${k}`);
						tl.set(layer("waiting"), { opacity: 1 }, b);
						for (const k of ["working", "review", "done"]) tl.set(layer(k), { opacity: 0 }, b);
						let prev = "waiting";
						for (const [t, to] of seq) {
							tl.to(layer(prev), { opacity: 0, duration: 0.3 }, b + t).to(
								layer(to),
								{ opacity: 1, duration: 0.3 },
								b + t,
							);
							prev = to;
						}
					};
					const goto = (task: string, name: string, at: number, dur = 0.9) => {
						const c = fly(task);
						const inner = c.firstElementChild;
						tl.set(c, { left: "50%", top: "20%" }, b)
							.fromTo(inner, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25 }, b + at)
							.to(c, { ...pos(name), duration: dur, ease: "power2.inOut" }, b + at + 0.1)
							.to(inner, { opacity: 0, scale: 0.4, duration: 0.3 }, b + at + 0.1 + dur);
					};
					const light = (name: string, at: number) => {
						const p = parts(name);
						tl.fromTo(p.lit, { opacity: 0 }, { opacity: 1, duration: 0.4 }, b + at).fromTo(
							p.work,
							{ opacity: 0 },
							{ opacity: 1, duration: 0.3 },
							b + at,
						);
					};
					const finish = (name: string, at: number) => {
						const p = parts(name);
						tl.to(p.work, { opacity: 0, duration: 0.2 }, b + at).fromTo(
							p.done,
							{ opacity: 0, scale: 0.4 },
							{ opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" },
							b + at,
						);
					};

					const nodes = s(".org-node-in");
					tl.fromTo(
						nodes,
						{ opacity: 0.3, scale: 0.88 },
						{ opacity: 1, scale: 1, duration: 0.5, stagger: 0.1 },
						b + 0.3,
					)
						.fromTo(s(".org-core-in"), { scale: 0.85 }, { scale: 1, duration: 0.6, ease: "back.out(1.6)" }, b + 0.2)
						.fromTo(
							s(".org-line:not(.org-line-review)"),
							{ strokeDashoffset: 1 },
							{ strokeDashoffset: 0, duration: 0.8, stagger: 0.1, ease: "power1.inOut" },
							b + 0.6,
						)
						.fromTo(s(".org-split-more"), { opacity: 0 }, { opacity: 1, duration: 0.6 }, b + 1.2)
						.fromTo(s(".org-split-list"), { y: 24 }, { y: 0, duration: 0.7, ease: "power2.out" }, b - 0.4);
					// Dimmed nodes keep their ring off until a task arrives.
					for (const n of org.split.nodes) {
						const p = parts(n);
						tl.set([p.lit, p.work, p.review, p.done], { opacity: 0 }, b);
					}

					// Task 1: Product.
					goto("1", "Product", 1.3);
					light("Product", 2.3);
					finish("Product", 3.2);
					stat(1, [
						[2.3, "working"],
						[3.2, "done"],
					]);
					// Tasks 2, 3 and 4 start together.
					goto("2", "Design", 3.6);
					goto("3", "Engineering", 3.7);
					goto("4", "Support", 3.8);
					light("Design", 4.7);
					light("Engineering", 4.8);
					light("Support", 4.9);
					stat(2, [
						[4.7, "working"],
						[6.4, "done"],
					]);
					stat(3, [
						[4.8, "working"],
						[7.0, "review"],
					]);
					stat(4, [
						[4.9, "working"],
						[5.9, "done"],
					]);
					finish("Support", 5.9);
					finish("Design", 6.4);
					// Engineering hands its work to Security for review.
					{
						const e = parts("Engineering");
						tl.to(e.work, { opacity: 0, duration: 0.2 }, b + 7)
							.fromTo(
								e.review,
								{ opacity: 0, scale: 0.4 },
								{ opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" },
								b + 7,
							)
							.fromTo(s(".org-line-review"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5 }, b + 7);
						const c = fly("review");
						const inner = c.firstElementChild;
						tl.set(c, { ...pos("Engineering") }, b)
							.fromTo(inner, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25 }, b + 7.2)
							.to(c, { ...pos("Security"), duration: 0.7, ease: "power2.inOut" }, b + 7.3)
							.to(inner, { opacity: 0, scale: 0.4, duration: 0.3 }, b + 8);
						light("Security", 8);
					}
				}

				// 4. Review: changes requested, revised, approved; and a card that waits for you.
				{
					const s = sel(3);
					const b = 3 * L;
					tl.fromTo(s(".org-rcard"), { y: 24 }, { y: 0, duration: 0.7, ease: "power2.out" }, b - 0.4)
						.fromTo(
							s(".org-right"),
							{ opacity: 0, x: 60, scale: 0.95 },
							{ opacity: 1, x: 0, scale: 1, duration: 1.4, ease: "power2.out" },
							b + 0.3,
						)
						.fromTo(
							s(".org-round[data-r='1'] .org-tag"),
							{ opacity: 0, scale: 0.7 },
							{ opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" },
							b + 0.4,
						)
						.fromTo(
							s(".org-round[data-r='1'] li"),
							{ opacity: 0, x: -10 },
							{ opacity: 1, x: 0, duration: 0.4, stagger: 0.5 },
							b + 0.9,
						)
						.fromTo(s(".org-round-mid"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, b + 2.6)
						.fromTo(
							s(".org-round[data-r='2'] .org-tag"),
							{ opacity: 0, scale: 0.7 },
							{ opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" },
							b + 3.8,
						)
						.fromTo(s(".org-round[data-r='2'] p"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, b + 4.3)
						.fromTo(
							s(".org-wait"),
							{ opacity: 0, y: 30 },
							{ opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
							b + 5.2,
						)
						.to(
							s(".org-wait .org-btn-primary"),
							{ scale: 1.07, duration: 0.35, yoyo: true, repeat: 1, ease: "sine.inOut" },
							b + 6.6,
						);
				}

				// 5. Delivered: everything lands in Done, SuperDot's report arrives.
				{
					const s = sel(4);
					const b = 4 * L;
					tl.fromTo(s(".org-col"), { y: 14 }, { y: 0, duration: 0.5, stagger: 0.12 }, b - 0.4)
						.fromTo(
							s(".org-right"),
							{ opacity: 0, x: 60, scale: 0.95 },
							{ opacity: 1, x: 0, scale: 1, duration: 1.4, ease: "power2.out" },
							b + 0.2,
						)
						.fromTo(s(".org-card"), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.35 }, b + 0.4)
						.fromTo(
							s(".org-report"),
							{ opacity: 0, y: 24 },
							{ opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
							b + 2.6,
						)
						.fromTo(
							s(".org-deliv li"),
							{ opacity: 0, scale: 0.85 },
							{ opacity: 1, scale: 1, duration: 0.4, stagger: 0.15, ease: "back.out(1.6)" },
							b + 3.6,
						)
						.fromTo(
							s(".org-shot-front"),
							{ opacity: 0, y: 40 },
							{ opacity: 1, y: 0, duration: 1, ease: "power2.out" },
							b + 3,
						);
				}

				// Hold the last beat for a moment before the pin releases.
				tl.to({}, { duration: 0.01 }, BEAT_COUNT * L - 0.01);

				return () => {
					ro.disconnect();
					stage.style.removeProperty("--org-s");
					typed.textContent = full;
					rest.textContent = "";
					delete root.dataset.beat;
					steps.forEach((el) => {
						el.classList.remove("is-on");
						el.classList.add("is-past");
					});
				};
			});
			return () => mm.revert();
		},
		{ scope: section },
	);

	return (
		<section ref={section} id="organisation" aria-labelledby="org-title" className="chapter-dark org-root">
			<div className="org-intro container-site">
				<Reveal stagger={0.08} className="org-head">
					<p className="t-caption org-eyebrow">{org.eyebrow}</p>
					<h2 id="org-title" className="org-h2">
						<span className="block">{org.h2[0]}</span>
						<span className="text-gradient block">{org.h2[1]}</span>
					</h2>
					<p className="t-lead org-lead">
						{org.lead}
						<LearnMore href={org.learnMore.href} label={org.learnMore.label} />
					</p>
					<ul className="org-stats">
						{org.stats.map((s) => (
							<li key={s.label}>
								<b className="text-gradient">{s.value}</b>
								<span>{s.label}</span>
							</li>
						))}
					</ul>
				</Reveal>
				<div aria-hidden="true">
					<Reveal stagger={0.05} className="org-cloud">
						{orgDepartments.map((d) => (
							<span key={d.id} className="org-cloud-chip">
								<i>
									<DeptIcon name={d.icon} size={16} />
								</i>
								{d.name}
							</span>
						))}
					</Reveal>
				</div>
			</div>

			<div ref={pin} className="org-pin">
				<div aria-hidden="true" className="org-glow" />
				<div className="org-pin-in container-site">
					<div className="org-rail" aria-hidden="true">
						<span className="org-rail-brand">{org.eyebrow}</span>
						<ol className="org-steps">
							{org.beats.map((b, i) => (
								<li key={b.id} className="org-step is-past">
									<span>{i + 1}</span>
									{b.label}
								</li>
							))}
						</ol>
						<span className="org-rail-note">{org.example}</span>
						<span className="org-rail-track">
							<span className="org-rail-fill" />
						</span>
					</div>
					<div className="org-view">
						<ol className="org-beats">
							{org.beats.map((b, i) => (
								<li key={b.id} className="org-beat" data-beat={b.id}>
									<div className="org-cap">
										<h3 className="org-cap-title">
											<span className="org-num" aria-hidden="true">
												{i + 1}
											</span>
											{b.title}
										</h3>
										<p className="org-cap-body">{b.body}</p>
									</div>
									<p className="sr-only">{beatText(b.id)}</p>
									<div className="org-left">{beatArt(b.id)}</div>
									<div className="org-right">{beatShots(b.id)}</div>
								</li>
							))}
						</ol>
					</div>
					<p className="org-example">{org.example}</p>
				</div>
			</div>
		</section>
	);
}

/** Departments, templates, the three promises, skills and the call to action. Normal flow, follows the system theme. */
function More() {
	return (
		<section
			id="organisation-more"
			aria-label="OpenDot Organisation: departments, control and skills"
			className="org-more section-pad bg-bg text-fg"
		>
			<div className="container-site">
				{/* Departments */}
				<div className="org-block">
					<Reveal stagger={0.08} className="org-block-head">
						<p className="t-caption org-eyebrow">{org.wall.eyebrow}</p>
						<h3 className="t-display-m">{org.wall.title}</h3>
						<p className="t-lead text-fg-2">{org.wall.lead}</p>
					</Reveal>
					<ul className="org-wall">
						{orgDepartments.map((d) => (
							<li key={d.id} className="org-tile">
								<span className="org-tile-ic" aria-hidden="true">
									<DeptIcon name={d.icon} size={22} />
								</span>
								<span className="org-tile-text">
									<b>{d.name}</b>
									<span>{d.job}</span>
								</span>
							</li>
						))}
						<li className="org-tile org-tile-note">{org.wall.note}</li>
					</ul>
				</div>

				{/* Templates */}
				<div className="org-block">
					<h3 className="t-title">{org.wall.templatesTitle}</h3>
					<ul className="org-templates">
						{org.wall.templates.map((t) => (
							<li key={t.name} className="org-template">
								<div className="org-template-top">
									<b>{t.name}</b>
									<span className="org-count">
										{t.count} {org.wall.dotsLabel}
									</span>
								</div>
								<p>{t.domains}</p>
							</li>
						))}
					</ul>
					<div className="org-shots-2">
						<Shot
							name="org-setup"
							alt={org.shots.setup}
							sizes="(min-width: 900px) 560px, 92vw"
							caption={org.wall.setupCap}
						/>
						<Shot
							name="org-team"
							alt={org.shots.team}
							sizes="(min-width: 900px) 560px, 92vw"
							caption={org.wall.teamCap}
						/>
					</div>
				</div>

				{/* In control */}
				<div className="org-block">
					<Reveal stagger={0.08} className="org-block-head org-block-head-center">
						<p className="t-caption org-eyebrow">{org.control.eyebrow}</p>
						<h3 className="t-display-m">{org.control.title}</h3>
					</Reveal>
					<ul className="org-control">
						{[Check, Shield, Pause].map((G, i) => {
							const item = org.control.items[i];
							if (!item) return null;
							return (
								<li key={item.title} className="org-control-card">
									<span className="org-control-ic">
										<Icon as={G} size={20} />
									</span>
									<h4 className="t-title">{item.title}</h4>
									<p className="t-body text-fg-2">{item.body}</p>
								</li>
							);
						})}
					</ul>
				</div>

				{/* Skills */}
				<div className="org-block">
					<div className="org-skills">
						<div className="org-skills-text">
							<p className="t-caption org-eyebrow">{org.skills.eyebrow}</p>
							<h3 className="t-display-m">{org.skills.title}</h3>
							<p className="t-body text-fg-2">{org.skills.body}</p>
							<ul className="org-skill-chips">
								{org.skills.examples.map((e) => (
									<li key={e}>{e}</li>
								))}
							</ul>
							<p className="t-caption text-fg-3">{org.skills.note}</p>
						</div>
						<Shot name="org-skills" alt={org.shots.skills} sizes="(min-width: 900px) 600px, 92vw" />
					</div>
				</div>

				{/* Call to action */}
				<div className="org-cta">
					<div className="org-cta-text">
						<h3 className="t-display-m">{org.cta.title}</h3>
						<p className="t-lead text-fg-2">{org.cta.body}</p>
						<div className="org-cta-btns">
							<GitHubButton>{org.cta.github}</GitHubButton>
							<Button variant="secondary" size="lg" href={org.cta.href}>
								{org.cta.how}
							</Button>
						</div>
					</div>
					<div className="org-cta-odi" aria-hidden="true">
						<Mascot pose="conductor" size={180} still />
					</div>
				</div>
			</div>
		</section>
	);
}

export function Organisation() {
	return (
		<>
			<Story />
			<More />
		</>
	);
}
