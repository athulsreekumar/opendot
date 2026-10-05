"use client";
import type React from "react";

import { type CSSProperties, type ReactNode, useRef } from "react";
import "./motion.css";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "./gsap";

export type RevealProps = {
	/** Element to render. Default "div". */
	as?: keyof HTMLElementTagNameMap;
	/** Seconds to wait before the reveal starts. */
	delay?: number;
	/** Rise distance in px (default 24). */
	y?: number;
	/** When set (seconds between items, e.g. 0.08), reveals the direct children in sequence instead of the element. */
	stagger?: number;
	className?: string;
	children?: ReactNode;
};

/**
 * Fade + rise + blur(4px→0) once when the element reaches 85% of the viewport.
 * Server output is the final visible state (see motion.css), so no-JS and JS-failure users still see everything.
 * Reduced motion: nothing moves.
 */
export function Reveal({ as, delay = 0, y = 24, stagger, className, children }: RevealProps) {
	const Tag = (as ?? "div") as "div";
	const ref = useRef<HTMLElement>(null);

	useGSAP(
		() => {
			const el = ref.current;
			if (!el) return;
			if (prefersReducedMotion()) {
				el.dataset.revealState = "static";
				return;
			}
			const from = { opacity: 0, y, filter: "blur(4px)" };
			const to = {
				opacity: 1,
				y: 0,
				filter: "blur(0px)",
				duration: 0.9,
				ease: "expo.out",
				clearProps: "filter,transform",
			};

			if (stagger === undefined) {
				gsap.set(el, from);
				el.dataset.revealState = "armed";
				gsap.to(el, {
					...to,
					delay,
					scrollTrigger: { trigger: el, start: "top 85%", once: true },
				});
				return;
			}

			const items = Array.from(el.children) as HTMLElement[];
			if (!items.length) {
				el.dataset.revealState = "armed";
				return;
			}
			gsap.set(items, from);
			el.dataset.revealState = "armed";
			ScrollTrigger.batch(items, {
				start: "top 85%",
				once: true,
				interval: 0.1,
				batchMax: 12,
				onEnter: (batch) => gsap.to(batch, { ...to, delay, stagger }),
			});
		},
		{ scope: ref, dependencies: [y, delay, stagger] },
	);

	return (
		<Tag
			ref={ref as React.RefObject<HTMLDivElement>}
			data-reveal={stagger === undefined ? "single" : "stagger"}
			className={className}
			style={{ "--reveal-y": `${y}px` } as CSSProperties}
		>
			{children}
		</Tag>
	);
}
