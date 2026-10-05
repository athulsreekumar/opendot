"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { ScrubText } from "@/components/motion/ScrubText";

/** Dev-only: ScrubText inside a pinned dark section (the Statement pattern). */
export function PinnedDemo() {
	const section = useRef<HTMLElement>(null);
	const inner = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			if (prefersReducedMotion()) return;
			const mm = gsap.matchMedia();
			mm.add("(min-width: 900px)", () => {
				gsap.timeline({
					scrollTrigger: {
						trigger: section.current,
						start: "top top",
						end: () => `+=${window.innerHeight * 1.5}`,
						pin: inner.current,
						scrub: true,
						invalidateOnRefresh: true,
					},
				});
			});
		},
		{ scope: section },
	);

	return (
		<section ref={section} className="chapter-dark relative">
			<div ref={inner} className="flex min-h-svh items-center">
				<div className="container-text">
					<ScrubText
						as="h2"
						className="t-display-m"
						trigger={section}
						start="top top"
						end={() => `+=${window.innerHeight * 1.5}`}
						text="Every Dot has a job, a personality, and only the access you give it. Together, they never sleep."
					/>
				</div>
			</div>
		</section>
	);
}
