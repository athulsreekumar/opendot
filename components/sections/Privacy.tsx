import clsx from "clsx";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Check, FileText, Folder, Icon, Lock, Shield } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { privacy } from "@/lib/copy";

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

function TreeIcon({ kind }: { kind: "folder" | "file" | "lock" }) {
	if (kind === "folder") return <Icon as={Folder} size={14} className="shrink-0 text-accent" />;
	if (kind === "lock") return <Icon as={Lock} size={14} className="shrink-0 text-accent" />;
	return <Icon as={FileText} size={14} className="shrink-0 text-fg-3" />;
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={clsx("font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-fg-3 sm:text-xs", className)}
		>
			{children}
		</span>
	);
}

/** Chapter 7: Privacy. Normal flow, in its final state: the masked value the cloud sees, the points, the local folder. */
export function Privacy() {
	return (
		<section id="privacy" className="chapter-dark relative bg-bg text-fg">
			<div className="section-pad">
				<div className="container-site">
					<Reveal className="text-center">
						<p className="t-caption font-semibold uppercase tracking-[0.14em] text-accent">
							<a href="/features/privacy" className="hover:underline">
								{privacy.eyebrow} ›
							</a>
						</p>
						<h2 className="t-display-l mt-3">{privacy.h2.join(" ")}</h2>
					</Reveal>

					{/* The masking demo, resolved */}
					<Reveal className="mx-auto mt-10 flex max-w-[960px] flex-col items-center">
						<p className="sr-only">
							Before masking, the value is {privacy.demo.before}. The cloud model sees {privacy.demo.after}. On your
							screen you still see {privacy.demo.before}.
						</p>
						<div aria-hidden="true" className="flex max-w-full flex-col items-center gap-3">
							<Label className="text-center text-accent">{LABEL_CLOUD}</Label>
							<div className="max-w-full rounded-[28px] rounded-bl-md border border-line bg-card px-5 py-3 shadow-card sm:px-8 sm:py-4">
								<span className="block whitespace-nowrap font-mono text-[clamp(17px,5vw,56px)] font-medium leading-tight tracking-tight text-accent sm:text-[clamp(28px,4vw,56px)]">
									{privacy.demo.after}
								</span>
							</div>
							<div className="mt-3 w-full max-w-[560px] space-y-1 font-mono text-[13px] leading-relaxed sm:text-[15px]">
								<p className="flex flex-wrap gap-x-3">
									<span className="w-[7.5rem] shrink-0 text-fg-3">Cloud model:</span>
									<span className="text-accent">{privacy.demo.after}</span>
								</p>
								<p className="flex flex-wrap gap-x-3">
									<span className="w-[7.5rem] shrink-0 text-fg-3">Your screen:</span>
									<span className="break-all text-fg">{privacy.demo.before}</span>
									<span className="sr-only">{LABEL_SCREEN}</span>
								</p>
							</div>
						</div>
					</Reveal>

					{/* Points + tree */}
					<Reveal className="mt-12 grid gap-10 lg:mt-14 lg:grid-cols-2 lg:gap-16">
						<ul className="space-y-4 lg:space-y-5">
							{privacy.points.map((pt, i) => {
								const G = POINT_ICONS[i % POINT_ICONS.length] ?? Check;
								return (
									<li key={pt} className="flex gap-3.5">
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
								role="img"
								aria-label="The ~/.opendot folder: settings.json, memory.json, per-Dot folders with dot.json, memory.json and session logs, an audit log, and an encrypted secrets.bin."
								className="rounded-[var(--radius)] border border-line bg-card/60 p-4 font-mono text-[12.5px] leading-[1.75] text-fg-2 sm:p-5 sm:text-[13px]"
							>
								{TREE.map((l) => (
									<div
										key={`${l.d}-${l.name}-${l.kind}`}
										className="flex items-center gap-2"
										style={{ paddingLeft: `${l.d * 18}px` }}
										aria-hidden="true"
									>
										<TreeIcon kind={l.kind} />
										<span className={l.d === 0 ? "text-fg" : undefined}>{l.name}</span>
									</div>
								))}
							</div>
							<div className="pointer-events-none absolute -bottom-6 -right-2 hidden sm:block lg:-right-10 lg:-bottom-10">
								<Mascot pose="shield" size={150} />
							</div>
						</div>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
