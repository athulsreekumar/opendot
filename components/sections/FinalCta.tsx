"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { EarlyAccessForm } from "@/components/site/EarlyAccessForm";
import { Mascot } from "@/components/ui/Mascot";
import { finalCta } from "@/lib/copy";

export function FinalCta() {
	const floatRef = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (prefersReducedMotion() || !floatRef.current) return;
			gsap.to(floatRef.current, { y: -12, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
		},
		{ scope: floatRef },
	);

	return (
		<section id="early-access" className="chapter-light section-pad relative overflow-hidden">
			<div className="container-site relative flex flex-col items-center text-center">
				<Reveal className="relative flex flex-col items-center">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute top-[100px] left-1/2 -z-0 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-45 blur-3xl"
						style={{ background: "radial-gradient(circle, var(--brand-glow) 0%, transparent 68%)" }}
					/>
					<div ref={floatRef} className="relative">
						<Mascot pose="envelope" size={200} />
					</div>
				</Reveal>
				<Reveal delay={0.08} className="relative mt-6">
					<h2 className="t-display-l">{finalCta.h2.join(" ")}</h2>
					<p className="t-lead mx-auto mt-5 max-w-[600px] text-fg-2">{finalCta.lead}</p>
				</Reveal>
				<Reveal delay={0.16} className="relative mt-10 w-full max-w-[560px]">
					<EarlyAccessForm source="final" variant="inline" />
					<p className="t-caption mt-6 text-fg-3">
						Want it now?{" "}
						<a href="/download" className="text-accent underline-offset-4 hover:underline">
							See how to download or build OpenDot
						</a>
						, or{" "}
						<a href="/features" className="text-accent underline-offset-4 hover:underline">
							explore the features
						</a>
						.
					</p>
				</Reveal>
			</div>
		</section>
	);
}
