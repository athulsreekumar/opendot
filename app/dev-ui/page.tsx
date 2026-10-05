import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { ScrubText } from "@/components/motion/ScrubText";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Icon, Mail, Shield, Sparkles, Zap } from "@/components/ui/Icon";
import { MacOnlyPill } from "@/components/ui/MacOnlyPill";
import { MacWindow } from "@/components/ui/MacWindow";
import { Screenshot } from "@/components/ui/Screenshot";
import { PinnedDemo } from "./PinnedDemo";

// Dev-only showcase. 404 in production unless SHOW_DEV_UI=1 (used for local `next start` screenshots).
export const dynamic = "force-dynamic";
export const metadata = { title: "UI kit", robots: { index: false } };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-3">
			<p className="t-caption text-fg-3 uppercase tracking-widest">{label}</p>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>
		</div>
	);
}

function Primitives({ forceDark }: { forceDark?: boolean }) {
	return (
		<div className="container-site flex flex-col gap-12 py-20">
			<Reveal>
				<h2 className="t-display-m">{forceDark ? "Dark chapter" : "Light chapter"}</h2>
			</Reveal>
			<Row label="Button · primary">
				<Button size="lg">Get early access</Button>
				<Button>Get early access</Button>
				<Button disabled>Disabled</Button>
				<Button href="#motion">As link</Button>
			</Row>
			<Row label="Button · secondary & ghost">
				<Button variant="secondary" size="lg" href="#motion">
					Watch the film
				</Button>
				<Button variant="secondary">View on GitHub</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="ghost" size="lg">
					Ghost large
				</Button>
			</Row>
			<Row label="MacOnlyPill">
				<MacOnlyPill />
				<MacOnlyPill detail />
			</Row>
			<Row label="Icon">
				{[Mail, Shield, Sparkles, Zap, ArrowRight].map((G, i) => (
					<Icon key={i} as={G} size={24} />
				))}
			</Row>
			<Row label="MacWindow + Screenshot (file missing → neutral box)">
				<div className="w-full max-w-3xl">
					<MacWindow>
						<Screenshot
							name="sidebar-full"
							alt="OpenDot sidebar listing every Dot"
							theme={forceDark ? "dark" : undefined}
						/>
					</MacWindow>
				</div>
				<div className="w-full max-w-sm">
					<MacWindow aspect={4 / 3} radius={20} title="OpenDot">
						<div className="grid place-items-center bg-bg-alt text-fg-2">With title</div>
					</MacWindow>
				</div>
			</Row>
		</div>
	);
}

export default function DevUiPage() {
	if (process.env.NODE_ENV === "production" && !process.env.SHOW_DEV_UI) notFound();
	return (
		<div id="motion">
			<section className="chapter-light overflow-clip">
				<Primitives />
			</section>
			<section className="chapter-dark overflow-clip">
				<Primitives forceDark />
			</section>

			<section className="section-pad">
				<div className="container-site flex flex-col gap-24">
					<Reveal as="h2" className="t-display-l">
						Reveal
					</Reveal>
					<Reveal as="p" className="t-lead max-w-xl text-fg-2">
						Fades, rises 24px and unblurs once, at the top 85% of the viewport.
					</Reveal>
					<Reveal stagger={0.08} className="grid gap-4 sm:grid-cols-3">
						{[1, 2, 3, 4, 5, 6].map((n) => (
							<div key={n} className="grid h-40 place-items-center rounded-lg bg-bg-alt t-title text-fg-2">
								Tile {n}
							</div>
						))}
					</Reveal>
				</div>
			</section>

			<PinnedDemo />

			<section className="section-pad">
				<div className="container-text">
					<ScrubText
						className="t-display-m"
						text="Unpinned ScrubText lights up as it scrolls through the viewport, one word after another."
					/>
				</div>
			</section>
			<div className="h-[40vh]" />
		</div>
	);
}
