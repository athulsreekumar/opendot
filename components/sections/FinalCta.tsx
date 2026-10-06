"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { EarlyAccessForm } from "@/components/site/EarlyAccessForm";
import { Button } from "@/components/ui/Button";
import { GitHubButton } from "@/components/ui/GitHubButton";
import { MacOnlyPill } from "@/components/ui/MacOnlyPill";
import { Mascot } from "@/components/ui/Mascot";
import { finalCta } from "@/lib/copy";
import { FEATURES } from "@/lib/features";

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
		<section id="get-opendot" className="chapter-light section-pad relative overflow-hidden">
			<div className="container-site relative flex flex-col items-center text-center">
				<Reveal className="relative flex flex-col items-center">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute top-[100px] left-1/2 -z-0 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-45 blur-3xl"
						style={{ background: "radial-gradient(circle, var(--brand-glow) 0%, transparent 68%)" }}
					/>
					<div ref={floatRef} className="relative">
						<Mascot pose="cheer" size={200} />
					</div>
				</Reveal>
				<Reveal delay={0.08} className="relative mt-6">
					<h2 className="t-display-l">{finalCta.h2.join(" ")}</h2>
					<p className="t-lead mx-auto mt-5 max-w-[600px] text-fg-2">{finalCta.lead}</p>
				</Reveal>
				<Reveal delay={0.16} className="relative mt-10 w-full max-w-[560px]">
					{FEATURES.earlyAccess ? (
						<EarlyAccessForm source="final" variant="inline" />
					) : (
						<div className="flex flex-col items-center gap-4">
							<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
								<GitHubButton>{finalCta.cta}</GitHubButton>
								<Button variant="secondary" size="lg" href="/download">
									{finalCta.build}
								</Button>
							</div>
							<MacOnlyPill detail />
						</div>
					)}
					<p className="t-caption mt-6 text-fg-3">
						New here?{" "}
						<a href="/features" className="text-accent underline-offset-4 hover:underline">
							Explore the features
						</a>{" "}
						or{" "}
						<a href="/guides" className="text-accent underline-offset-4 hover:underline">
							read a guide
						</a>
						.
					</p>
				</Reveal>
			</div>
		</section>
	);
}
