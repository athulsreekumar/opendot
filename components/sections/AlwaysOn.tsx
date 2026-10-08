import clsx from "clsx";
import { Reveal } from "@/components/motion/Reveal";
import { Calendar, FileText, Icon, Mail } from "@/components/ui/Icon";
import { MacWindow } from "@/components/ui/MacWindow";
import { Mascot } from "@/components/ui/Mascot";
import { Screenshot } from "@/components/ui/Screenshot";
import { alwaysOn } from "@/lib/copy";
import "./AlwaysOn.css";
import { LearnMore } from "./LearnMore";

const SOURCE_ICON = [
	{ icon: Mail, bg: "linear-gradient(160deg,#60a5fa,#2563eb)" },
	{ icon: Calendar, bg: "linear-gradient(160deg,#fb7185,#e11d48)" },
	{ icon: FileText, bg: "linear-gradient(160deg,#fbbf24,#d97706)" },
];

const badgeStyle = [
	"border-[#ff6b5e]/40 bg-[#ff6b5e]/15 text-[#ff8a7a]",
	"border-accent/40 bg-accent/15 text-accent",
	"border-line bg-white/[0.06] text-fg-2",
];

/** Chapter 5: Always on. Normal flow: the events, then the quiet update they produced, in its final state. */
export function AlwaysOn() {
	return (
		<section id="always-on" className="chapter-dark ao-root">
			<div className="ao-inner">
				<div className="container-site">
					<Reveal stagger={0.08} className="mx-auto flex max-w-5xl flex-col items-center text-center">
						<p className="t-caption mb-4 uppercase tracking-[0.14em] text-accent">{alwaysOn.eyebrow}</p>
						<h2 className="t-display-l">{alwaysOn.h2[0]}</h2>
						<p className="t-lead mt-5 max-w-2xl text-fg-2">
							{alwaysOn.lead}
							<LearnMore href="/features/always-on" label="Learn more about always-on Dots" />
						</p>
					</Reveal>
				</div>

				<div className="ao-body container-site relative">
					<div className="mx-auto max-w-[1000px]">
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

					<div className="mt-8 flex flex-col items-center gap-8 min-[900px]:flex-row min-[900px]:justify-center min-[900px]:gap-14">
						<ul className="flex flex-wrap items-center justify-center gap-3">
							{alwaysOn.badges.map((b, i) => (
								<li
									key={b}
									className={clsx(
										"t-caption rounded-full border px-4 py-1.5 font-semibold tracking-wide",
										badgeStyle[i],
									)}
								>
									{b}
								</li>
							))}
						</ul>

						<div className="flex flex-col items-center gap-3 text-center min-[900px]:order-first min-[900px]:flex-row min-[900px]:gap-5 min-[900px]:text-left">
							<div className="relative size-[120px] shrink-0">
								<div aria-hidden="true" className="ao-moon absolute -inset-10 rounded-full blur-2xl" />
								<Mascot pose="night" size={120} className="relative" />
							</div>
							<p className="t-caption max-w-[14rem] text-fg-3">{alwaysOn.footnote}</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
