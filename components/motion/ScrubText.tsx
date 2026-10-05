"use client";

import { type ElementType, type RefObject, useEffect, useRef } from "react";
import "./motion.css";
import { gsap, prefersReducedMotion } from "./gsap";

export type ScrubTextProps = {
	/** The sentence. Words light up from 15% to 100% opacity, one after another, as you scroll. */
	text: string;
	/** Element to render. Default "p". */
	as?: ElementType;
	className?: string;
	/** Element whose scroll progress drives the effect (e.g. a pinned section). Defaults to the text itself. */
	trigger?: RefObject<HTMLElement | null>;
	/** ScrollTrigger start (default "top 80%"). */
	start?: string | (() => string);
	/** ScrollTrigger end (default "bottom 35%"). */
	end?: string | (() => string);
};

/**
 * Scroll-scrubbed word highlight. Accessible: screen readers get the full sentence once (visually-hidden copy),
 * the split words are aria-hidden. Parent decides pinning; pass `trigger`/`start`/`end` to bind to its range.
 * Inside a pinned section use the pin's own numbers (not "bottom …", which is measured before the pin spacer
 * exists, and "+=%" drifts once spacers exist): pass px via a function, e.g.
 * `<ScrubText trigger={section} start="top top" end={() => `+=${innerHeight * 1.5}`} />` for a 150vh pin.
 * Reduced motion / no JS: fully visible.
 */
export function ScrubText({ text, as, className, trigger, start = "top 80%", end = "bottom 35%" }: ScrubTextProps) {
	const Tag = (as ?? "p") as ElementType;
	const ref = useRef<HTMLElement>(null);
	const words = text.split(/\s+/).filter(Boolean);

	// start/end are read once per mount (inline functions would otherwise rebuild the trigger every render).
	// useEffect (not a layout effect): a parent's `trigger` ref is only attached after children's layout effects.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional, see above
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const ctx = gsap.context(() => {
			if (prefersReducedMotion()) {
				el.dataset.scrubState = "static";
				return;
			}
			const targets = el.querySelectorAll(".od-word");
			gsap.set(targets, { opacity: 0.15 });
			el.dataset.scrubState = "armed";
			gsap.to(targets, {
				opacity: 1,
				ease: "none",
				duration: 3,
				stagger: 1,
				scrollTrigger: { trigger: trigger?.current ?? el, start, end, scrub: 0.6, invalidateOnRefresh: true },
			});
		}, ref);
		return () => ctx.revert();
	}, [text, trigger]);

	return (
		<Tag ref={ref} data-scrub="" className={className}>
			<span className="sr-only">{text}</span>
			<span aria-hidden="true">
				{words.map((w, i) => (
					<span key={i}>
						<span className="od-word">{w}</span>
						{i < words.length - 1 ? " " : null}
					</span>
				))}
			</span>
		</Tag>
	);
}
