"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Cloud, Laptop, Link2 } from "@/components/ui/Icon";
import { anyModel } from "@/lib/copy";
import "./AnyModel.css";

export function AnyModel() {
	return (
		<section id="models" className="chapter-light section-pad">
			<Reveal className="container-site flex flex-col items-center gap-12">
				{/* Eyebrow + H2 + Lead */}
				<div className="flex flex-col items-center gap-6 text-center">
					<p className="t-caption text-accent uppercase tracking-wider">{anyModel.eyebrow}</p>
					<h2 className="t-display-l max-w-4xl">
						<span>{anyModel.h2[0]}</span>
						{"\n"}
						<span className="text-gradient">{anyModel.h2[1]}</span>
					</h2>
					<p className="t-lead text-fg-2 max-w-[40ch]">{anyModel.lead}</p>
				</div>

				{/* Marquee rows */}
				<div className="w-full space-y-8">
					{/* Row A - scrolls left */}
					<div className="od-marquee od-marquee-ltr">
						<div className="od-marquee-track">
							{/* Original content */}
							{anyModel.rowA.map((model, i) => (
								<span key={`row-a-1-${i}`} className="od-marquee-item">
									{model}
									{i < anyModel.rowA.length - 1 && <span className="od-marquee-sep">•</span>}
								</span>
							))}
							{/* Duplicate for seamless loop */}
							{anyModel.rowA.map((model, i) => (
								<span key={`row-a-2-${i}`} className="od-marquee-item" aria-hidden="true">
									{model}
									{i < anyModel.rowA.length - 1 && <span className="od-marquee-sep">•</span>}
								</span>
							))}
						</div>
					</div>

					{/* Row B - scrolls right */}
					<div className="od-marquee od-marquee-rtl">
						<div className="od-marquee-track">
							{/* Original content */}
							{anyModel.rowB.map((model, i) => (
								<span key={`row-b-1-${i}`} className="od-marquee-item">
									{model}
									{i < anyModel.rowB.length - 1 && <span className="od-marquee-sep">•</span>}
								</span>
							))}
							{/* Duplicate for seamless loop */}
							{anyModel.rowB.map((model, i) => (
								<span key={`row-b-2-${i}`} className="od-marquee-item" aria-hidden="true">
									{model}
									{i < anyModel.rowB.length - 1 && <span className="od-marquee-sep">•</span>}
								</span>
							))}
						</div>
					</div>
				</div>

				{/* Trio */}
				<div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4">
					{[
						{ icon: Cloud, label: anyModel.trio[0] },
						{ icon: Laptop, label: anyModel.trio[1] },
						{ icon: Link2, label: anyModel.trio[2] },
					].map(({ icon: Icon, label }, i) => (
						<div key={i} className="flex flex-col items-center gap-3">
							<Icon className="text-accent" size={24} strokeWidth={1.75} />
							<p className="t-title text-fg text-center">{label}</p>
						</div>
					))}
				</div>
			</Reveal>
		</section>
	);
}
