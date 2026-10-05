"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { GITHUB_URL, openSource } from "@/lib/copy";
import "./OpenSource.css";

export function OpenSource() {
	return (
		<section id="open-source" className="chapter-dark section-pad relative overflow-hidden">
			{/* Large background "MIT" text */}
			<div className="absolute inset-0 pointer-events-none flex items-center justify-center">
				<div className="od-mit-text">MIT</div>
			</div>

			<Reveal className="container-site relative z-10 flex flex-col items-center gap-6 text-center">
				{/* Eyebrow */}
				<p className="t-caption text-accent uppercase tracking-wider">{openSource.eyebrow}</p>

				{/* H2 */}
				<h2 className="t-display-l max-w-4xl">
					<span>{openSource.h2[0]}</span>
					{"\n"}
					<span>{openSource.h2[1]}</span>
				</h2>

				{/* Lead */}
				<p className="t-lead text-fg-2 max-w-[40ch]">{openSource.lead}</p>

				{/* GitHub Button */}
				<Button
					variant="secondary"
					size="md"
					href={GITHUB_URL}
					target="_blank"
					rel="noopener noreferrer"
				>
					{openSource.link}
				</Button>
			</Reveal>
		</section>
	);
}
