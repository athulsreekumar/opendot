import clsx from "clsx";
import { Reveal } from "@/components/motion/Reveal";
import { MacWindow } from "@/components/ui/MacWindow";
import { Mascot } from "@/components/ui/Mascot";
import { Screenshot } from "@/components/ui/Screenshot";
import { createDot } from "@/lib/copy";

const SHOTS = [
	{ name: "new-dot-describe", alt: "The New Dot sheet with a plain-English description of what the Dot should do." },
	{ name: "new-dot-review", alt: "Reviewing the Dot's connectors and permissions before it is created." },
	{ name: "new-dot-created", alt: "The new Dot, named and styled by OpenDot, live in the sidebar." },
];

function Step({ i, title, body }: { i: number; title: string; body: string }) {
	return (
		<div className="relative">
			<p className="t-caption mb-2 font-semibold tracking-wide text-accent">{String(i + 1).padStart(2, "0")}</p>
			<h3 className="t-title text-fg">{title}</h3>
			<p className="t-body mt-2 text-fg-2">{body}</p>
		</div>
	);
}

/** Chapter 3: Create a Dot. Normal flow: each of the three steps next to its screenshot (alternating sides on desktop). */
export function CreateDot() {
	return (
		<section id="create" className="chapter-light bg-bg text-fg">
			<div className="section-pad">
				<div className="container-site">
					<div className="text-center">
						<Reveal as="p" className="t-caption font-semibold uppercase tracking-[0.14em] text-accent">
							<a href="/features" className="hover:underline">
								{createDot.eyebrow} ›
							</a>
						</Reveal>
						<Reveal as="h2" delay={0.06} className="t-display-l mt-4">
							<span className="block">{createDot.h2[0]}</span>
							<span className="text-gradient block pb-[0.08em]">{createDot.h2[1]}</span>
						</Reveal>
					</div>

					<div className="mx-auto mt-12 flex max-w-[640px] flex-col gap-14 min-[900px]:mt-16 min-[900px]:max-w-[1120px] min-[900px]:gap-20">
						{createDot.steps.map((s, i) => (
							<Reveal
								key={s.title}
								className={clsx(
									"flex flex-col gap-6 min-[900px]:grid min-[900px]:items-center min-[900px]:gap-14",
									i === 1 ? "min-[900px]:grid-cols-[7fr_5fr]" : "min-[900px]:grid-cols-[5fr_7fr]",
								)}
							>
								<div
									className={clsx(
										"flex items-end justify-between gap-4 min-[900px]:block",
										i === 1 && "min-[900px]:order-2",
									)}
								>
									<Step i={i} title={s.title} body={s.body} />
									{i === 2 && (
										<Mascot pose="cheer" size={110} className="-mb-2 shrink-0 min-[900px]:mt-6 min-[900px]:mb-0" />
									)}
								</div>
								<MacWindow>
									<Screenshot
										name={SHOTS[i]?.name ?? ""}
										alt={SHOTS[i]?.alt ?? ""}
										theme="light"
										sizes="(min-width: 900px) 660px, (min-width: 640px) 640px, 100vw"
									/>
								</MacWindow>
							</Reveal>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
