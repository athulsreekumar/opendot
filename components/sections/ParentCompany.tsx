import { Reveal } from "@/components/motion/Reveal";
import { parentCompany } from "@/lib/copy";

/** The company behind OpenDot. Links out to its site in a new tab. */
export function ParentCompany() {
	return (
		<section id="the-other-company" className="chapter-dark section-pad relative bg-bg text-fg">
			<div className="container-site grid gap-8 md:grid-cols-2 md:gap-16">
				<Reveal>
					<p className="t-caption font-semibold text-brand-glow">{parentCompany.label}</p>
					<h2 className="t-display-m mt-4">{parentCompany.h2}</h2>
				</Reveal>
				<Reveal delay={0.08} className="flex flex-col items-start gap-5">
					<p className="t-lead text-fg">{parentCompany.lead}</p>
					<p className="text-fg-2">{parentCompany.body}</p>
					<a
						href={parentCompany.href}
						target="_blank"
						rel="noopener"
						className="t-caption font-semibold text-fg underline decoration-brand-glow underline-offset-4 transition-colors duration-200 hover:text-accent"
					>
						{parentCompany.cta} <span aria-hidden="true">↗</span>
						<span className="sr-only"> (opens in a new tab)</span>
					</a>
				</Reveal>
			</div>
		</section>
	);
}
