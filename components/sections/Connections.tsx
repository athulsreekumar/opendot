import { Calendar, Check, Cloud, FileText, Folder, type LucideIcon, Mail, Server, User, Webhook } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Icon } from "@/components/ui/Icon";
import { MacWindow } from "@/components/ui/MacWindow";
import { Screenshot } from "@/components/ui/Screenshot";
import { connections as copy } from "@/lib/copy";
import { ConnectionsMcp } from "./ConnectionsMcp";
import { LearnMore } from "./LearnMore";

const ICONS: LucideIcon[] = [Mail, Cloud, Calendar, Server, Webhook, Folder];
const CHIPS: Record<number, string[]> = {
	0: ["Gmail", "Google Calendar", "Google Drive"],
	1: ["Outlook", "Calendar", "OneDrive", "Teams"],
};
const MAC_APPS: { icon: LucideIcon; label: string }[] = [
	{ icon: Calendar, label: "Calendar" },
	{ icon: Check, label: "Reminders" },
	{ icon: User, label: "Contacts" },
	{ icon: FileText, label: "Notes" },
];
const SPANS = ["", "", "", "md:col-span-2 md:row-span-2 lg:col-span-2 lg:row-span-2", "", ""];

export function Connections() {
	return (
		<section id="connections" className="chapter-light section-pad">
			<div className="container-site">
				<Reveal className="mx-auto max-w-3xl text-center">
					<p className="t-caption mb-4 font-semibold uppercase tracking-[0.14em] text-accent">{copy.eyebrow}</p>
					<h2 className="t-display-l">{copy.h2.join(" ")}</h2>
					<p className="t-lead mx-auto mt-5 max-w-2xl text-fg-2">
						{copy.lead}
						<LearnMore href="/features/connections" label="Learn more about connections and MCP" />
					</p>
				</Reveal>

				<Reveal stagger={0.08} className="mt-14 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
					{copy.tiles.map((tile, i) => {
						const hero = i === 3;
						return (
							<article
								key={tile.title}
								className={`group relative flex flex-col overflow-hidden rounded-lg border border-line p-7 shadow-card transition-transform duration-500 ease-out md:p-9 md:hover:-translate-y-1 ${
									hero ? "bg-bg-alt" : "bg-card"
								} ${SPANS[i]}`}
							>
								<span className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
									<Icon as={ICONS[i] as LucideIcon} size={28} />
								</span>
								<h3 className="t-title mt-6">{tile.title}</h3>
								<p className="t-body mt-2 text-fg-2">{tile.body}</p>

								{CHIPS[i] && (
									<ul className="mt-6 flex flex-wrap gap-2">
										{CHIPS[i].map((c) => (
											<li key={c} className="t-caption rounded-full border border-line bg-bg-alt px-3 py-1 text-fg-2">
												{c}
											</li>
										))}
									</ul>
								)}
								{i === 2 && (
									<ul className="mt-6 flex gap-3" aria-hidden>
										{MAC_APPS.map((a) => (
											<li
												key={a.label}
												title={a.label}
												className="flex size-11 items-center justify-center rounded-xl bg-bg-alt text-accent shadow-card"
											>
												<Icon as={a.icon} size={20} />
											</li>
										))}
									</ul>
								)}
								{hero && <ConnectionsMcp />}
							</article>
						);
					})}
				</Reveal>

				<Reveal className="mx-auto mt-14 max-w-5xl md:mt-20" y={40}>
					<MacWindow>
						<Screenshot
							name="connections"
							theme="light"
							alt="OpenDot connections settings listing Google Workspace, Microsoft 365, Mac and MCP servers"
							sizes="(min-width: 1024px) 1024px, 100vw"
						/>
					</MacWindow>
				</Reveal>
			</div>
		</section>
	);
}
