"use client";

import { Fragment, useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { ScrubText } from "@/components/motion/ScrubText";
import { statement } from "@/lib/copy";

/** Words that end in the brand glow colour (matched without punctuation, lower-case). */
const GLOW = new Set(["job", "personality", "never", "sleep"]);
const bare = (w: string) => w.replace(/[^\p{L}]/gu, "").toLowerCase();

const PIN_VH = 1.5;

/** Chapter 2: the pinned, word-by-word statement. Mobile / reduced motion: the plain sentence, fully visible. */
export function Statement() {
	const section = useRef<HTMLElement>(null);
	const inner = useRef<HTMLDivElement>(null);
	const scrubWrap = useRef<HTMLDivElement>(null);

	// Tint the glow words inside the ScrubText spans (ScrubText only owns their opacity).
	useEffect(() => {
		for (const el of scrubWrap.current?.querySelectorAll<HTMLElement>(".od-word") ?? []) {
			if (GLOW.has(bare(el.textContent ?? ""))) el.classList.add("text-brand-glow");
		}
	}, []);

	useGSAP(
		() => {
			const mm = gsap.matchMedia();
			mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
				gsap.timeline({
					scrollTrigger: {
						trigger: section.current,
						start: "top top",
						end: () => `+=${window.innerHeight * PIN_VH}`,
						pin: inner.current,
						anticipatePin: 1,
						scrub: true,
						invalidateOnRefresh: true,
					},
				});
			});
		},
		{ scope: section },
	);

	const words = statement.split(/\s+/);

	return (
		<section ref={section} id="statement" className="chapter-dark relative bg-bg text-fg">
			<div ref={inner} className="flex min-h-svh items-center py-24 min-[900px]:motion-safe:py-0">
				<div className="container-site">
					{/* Desktop, motion allowed: scrubbed word-by-word. */}
					<div ref={scrubWrap} className="hidden min-[900px]:motion-safe:block">
						<ScrubText
							as="h2"
							className="t-display-m mx-auto max-w-[22ch] text-center text-[clamp(2.75rem,1.2rem+3.6vw,4.5rem)]!"
							trigger={section}
							start="top top"
							end={() => `+=${window.innerHeight * PIN_VH}`}
							text={statement}
						/>
					</div>
					{/* Mobile / reduced motion: static sentence. */}
					<Reveal className="min-[900px]:motion-safe:hidden">
						<h2 className="t-display-m mx-auto max-w-[22ch] text-center">
							{words.map((w, i) => (
								<Fragment key={i}>
									<span className={GLOW.has(bare(w)) ? "text-brand-glow" : undefined}>{w}</span>
									{i < words.length - 1 ? " " : null}
								</Fragment>
							))}
						</h2>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
