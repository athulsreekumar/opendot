"use client";

import clsx from "clsx";
import { type ReactNode, useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Check, FileText, Folder, Icon, Lock, Shield } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { privacy } from "@/lib/copy";

const GLYPHS = "▒░▓⟦⟧█";
const LABEL_YOU = "You";
const LABEL_CLOUD = "What the cloud model sees";
const LABEL_SCREEN = "What you see";

const TREE: { d: number; kind: "folder" | "file" | "lock"; name: string }[] = [
	{ d: 0, kind: "folder", name: "~/.opendot" },
	{ d: 1, kind: "file", name: "settings.json" },
	{ d: 1, kind: "file", name: "memory.json" },
	{ d: 1, kind: "folder", name: "dots/" },
	{ d: 2, kind: "folder", name: "inbox/" },
	{ d: 3, kind: "file", name: "dot.json" },
	{ d: 3, kind: "file", name: "memory.json" },
	{ d: 3, kind: "folder", name: "sessions/" },
	{ d: 4, kind: "file", name: "2026-10-05.jsonl" },
	{ d: 1, kind: "folder", name: "audit/" },
	{ d: 2, kind: "file", name: "audit.jsonl" },
	{ d: 1, kind: "lock", name: "secrets.bin" },
];

const POINT_ICONS = [Check, Shield, Check, Lock];

/** Deterministic pseudo-random glyph for (char index, frame). Same inputs, same output, so scrubbing backwards works. */
function glyphAt(i: number, frame: number): string {
	let h = (i * 374761393 + frame * 668265263) >>> 0;
	h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
	return GLYPHS.charAt(h % GLYPHS.length);
}

/** Pure function of progress p in [0,1]: scrambles `from` left-to-right and resolves it into `to`. */
export function morph(from: string, to: string, p: number): string {
	if (p <= 0) return from;
	if (p >= 1) return to;
	const len = Math.max(from.length, to.length);
	const frame = Math.floor(p * 48);
	let out = "";
	for (let i = 0; i < len; i++) {
		const start = (i / len) * 0.6;
		const end = start + 0.4;
		if (p < start) out += from[i] ?? "";
		else if (p >= end) out += to[i] ?? "";
		else out += glyphAt(i, frame);
	}
	return out;
}

function TreeIcon({ kind }: { kind: "folder" | "file" | "lock" }) {
	if (kind === "folder") return <Icon as={Folder} size={14} className="shrink-0 text-accent" />;
	if (kind === "lock") return <Icon as={Lock} size={14} className="shrink-0 text-accent" />;
	return <Icon as={FileText} size={14} className="shrink-0 text-fg-3" />;
}

function Label({
	children,
	className,
	...rest
}: { children: ReactNode; className?: string } & Record<string, unknown>) {
	return (
		<span
			className={clsx("font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-fg-3 sm:text-xs", className)}
			{...rest}
		>
			{children}
		</span>
	);
}

export function Privacy() {
	const root = useRef<HTMLElement>(null);
	const inner = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (prefersReducedMotion()) return;
			const q = <T extends Element = HTMLElement>(s: string) => root.current?.querySelector<T>(s) ?? null;
			const qa = (s: string) => Array.from(root.current?.querySelectorAll<HTMLElement>(s) ?? []);
			const mm = gsap.matchMedia();

			mm.add("(min-width: 900px)", () => {
				const bigText = q("[data-big]");
				const bigNode = bigText?.firstChild as Text | null;
				const labelYou = q("[data-label-you]");
				const labelCloud = q("[data-label-cloud]");
				const stack = q("[data-stack]");
				const screenRow = q("[data-screen-row]");
				const treeLines = qa("[data-tree-line]");
				const points = qa("[data-point]");
				const mascot = q("[data-mascot]");
				if (!bigText || !bigNode) return;

				const state = { p: 0 };
				const render = () => {
					bigNode.nodeValue = morph(privacy.demo.before, privacy.demo.after, state.p);
					bigText.dataset.resolved = state.p > 0.02 ? "1" : "0";
				};
				render();

				gsap.set(labelYou, { opacity: 1 });
				gsap.set(labelCloud, { opacity: 0, y: 6 });
				gsap.set(stack, { opacity: 0, y: 16 });
				gsap.set(screenRow, { opacity: 0.0 });
				gsap.set(treeLines, { opacity: 0, x: 10 });
				gsap.set(points, { opacity: 0, y: 14 });
				gsap.set(mascot, { opacity: 0, scale: 0.85 });

				const tl = gsap.timeline({
					defaults: { ease: "none" },
					scrollTrigger: {
						trigger: root.current,
						start: "top top",
						end: () => `+=${window.innerHeight * 2}`,
						pin: inner.current,
						scrub: 0.8,
						anticipatePin: 1,
						invalidateOnRefresh: true,
					},
				});
				tl.to({}, { duration: 1 }) // hold on the real value
					.to(state, { p: 1, duration: 3, onUpdate: render, ease: "none" })
					.to(labelYou, { opacity: 0, y: -6, duration: 0.4 }, 3.6)
					.to(labelCloud, { opacity: 1, y: 0, duration: 0.5 }, 3.8)
					.to(stack, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 4.6)
					.to(screenRow, { opacity: 1, duration: 0.6 }, 5.2)
					.to(treeLines, { opacity: 1, x: 0, duration: 0.5, stagger: 0.3, ease: "power2.out" }, 6.2)
					.to(points, { opacity: 1, y: 0, duration: 0.8, stagger: 0.9, ease: "power2.out" }, 6.2)
					.to(mascot, { opacity: 1, scale: 1, duration: 1, ease: "back.out(1.6)" }, 8.4)
					.to({}, { duration: 1 });
			});
		},
		{ scope: root },
	);

	return (
		<section ref={root} id="privacy" className="chapter-dark relative bg-bg text-fg">
			<div ref={inner} className="flex min-h-svh flex-col justify-center py-24 lg:py-16">
				<div className="container-site">
					<div className="text-center">
						<p className="t-caption font-semibold uppercase tracking-[0.14em] text-accent">
							<a href="/features/privacy" className="hover:underline">
								{privacy.eyebrow} ›
							</a>
						</p>
						<h2 className="t-display-l mt-3">{privacy.h2.join(" ")}</h2>
					</div>

					{/* Stage: the morph */}
					<div className="mx-auto mt-10 flex max-w-[960px] flex-col items-center lg:mt-8">
						<p className="sr-only">
							Before masking, the value is {privacy.demo.before}. The cloud model sees {privacy.demo.after}. On your
							screen you still see {privacy.demo.before}.
						</p>
						<div aria-hidden="true" className="flex max-w-full flex-col items-center gap-3">
							<div className="relative h-4 w-screen max-w-full">
								<Label data-label-you className="absolute inset-x-0 text-center opacity-0">
									{LABEL_YOU}
								</Label>
								<Label data-label-cloud className="absolute inset-x-0 text-center text-accent">
									{LABEL_CLOUD}
								</Label>
							</div>
							<div className="max-w-full rounded-[28px] rounded-bl-md border border-line bg-card px-5 py-3 shadow-card sm:px-8 sm:py-4">
								<span
									data-big
									data-resolved="1"
									className="block whitespace-nowrap font-mono text-[clamp(17px,5vw,56px)] font-medium leading-tight tracking-tight text-fg data-[resolved=1]:text-accent sm:text-[clamp(28px,4vw,56px)]"
								>
									{privacy.demo.after}
								</span>
							</div>
							<div
								data-stack
								className="mt-3 w-full max-w-[560px] space-y-1 font-mono text-[13px] leading-relaxed sm:text-[15px]"
							>
								<p className="flex flex-wrap gap-x-3">
									<span className="w-[7.5rem] shrink-0 text-fg-3">Cloud model:</span>
									<span className="text-accent">{privacy.demo.after}</span>
								</p>
								<p data-screen-row className="flex flex-wrap gap-x-3">
									<span className="w-[7.5rem] shrink-0 text-fg-3">Your screen:</span>
									<span className="break-all text-fg">{privacy.demo.before}</span>
									<span className="sr-only">{LABEL_SCREEN}</span>
								</p>
							</div>
						</div>
					</div>

					{/* Points + tree */}
					<div className="mt-12 grid gap-10 lg:mt-10 lg:grid-cols-2 lg:gap-16">
						<ul className="space-y-4 lg:space-y-5">
							{privacy.points.map((pt, i) => {
								const G = POINT_ICONS[i % POINT_ICONS.length] ?? Check;
								return (
									<li key={pt} data-point className="flex gap-3.5">
										<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
											<Icon as={G} size={15} />
										</span>
										<span className="t-body text-fg-2">{pt}</span>
									</li>
								);
							})}
						</ul>

						<div className="relative">
							<div
								data-tree
								role="img"
								aria-label="The ~/.opendot folder: settings.json, memory.json, per-Dot folders with dot.json, memory.json and session logs, an audit log, and an encrypted secrets.bin."
								className="rounded-[var(--radius)] border border-line bg-card/60 p-4 font-mono text-[12.5px] leading-[1.75] text-fg-2 sm:p-5 sm:text-[13px]"
							>
								{TREE.map((l) => (
									<div
										key={`${l.d}-${l.name}-${l.kind}`}
										data-tree-line
										className="flex items-center gap-2"
										style={{ paddingLeft: `${l.d * 18}px` }}
										aria-hidden="true"
									>
										<TreeIcon kind={l.kind} />
										<span className={l.d === 0 ? "text-fg" : undefined}>{l.name}</span>
										{l.kind === "lock" && <Icon as={Lock} size={12} className="shrink-0 text-fg-3" />}
									</div>
								))}
							</div>
							<div
								data-mascot
								className="pointer-events-none absolute -bottom-6 -right-2 hidden sm:block lg:-right-10 lg:-bottom-10"
							>
								<Mascot pose="shield" size={150} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
