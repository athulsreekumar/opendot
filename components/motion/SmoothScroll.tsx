"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, ScrollTrigger } from "./gsap";
import { useReducedMotion } from "./useReducedMotion";

declare global {
	interface Window {
		/** The live Lenis instance (undefined under reduced motion). Prefer stopScroll()/startScroll(). */
		__lenis?: Lenis;
	}
}

/** Freeze page scroll (call when a dialog opens). No-op when smooth scroll is disabled. */
export function stopScroll() {
	window.__lenis?.stop();
}
/** Resume page scroll (call when a dialog closes). */
export function startScroll() {
	window.__lenis?.start();
}

const NAV_OFFSET = -64;

/**
 * Document Y of an anchor target. While a section is pinned, ScrollTrigger makes it position:fixed, so its own
 * rect reports "top of the viewport". Measure the in-flow .pin-spacer that stands in for it instead.
 */
function anchorY(target: HTMLElement): number {
	const inFlow = target.closest<HTMLElement>(".pin-spacer") ?? target;
	return Math.max(0, inFlow.getBoundingClientRect().top + window.scrollY + NAV_OFFSET);
}

function targetFor(hash: string): HTMLElement | null {
	if (!hash || hash === "#" || hash === "#top") return null;
	try {
		return document.getElementById(decodeURIComponent(hash.slice(1)));
	} catch {
		return null;
	}
}

/**
 * Lenis smooth scrolling, driven by GSAP's ticker (one rAF) and synced to ScrollTrigger.
 * Mounted once in the root layout. Renders nothing. Fully disabled under reduced motion.
 */
export function SmoothScroll() {
	const reduced = useReducedMotion();

	useEffect(() => {
		const refresh = () => ScrollTrigger.refresh();
		let cancelled = false;
		document.fonts?.ready.then(() => {
			if (!cancelled) refresh();
		});
		if (document.readyState === "complete") refresh();
		else window.addEventListener("load", refresh, { once: true });
		return () => {
			cancelled = true;
			window.removeEventListener("load", refresh);
		};
	}, []);

	useEffect(() => {
		if (reduced) return;

		const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, autoRaf: false });
		window.__lenis = lenis;

		lenis.on("scroll", ScrollTrigger.update);
		const tick = (time: number) => lenis.raf(time * 1000);
		gsap.ticker.add(tick);
		gsap.ticker.lagSmoothing(0);

		const onClick = (e: MouseEvent) => {
			if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
			if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
			const hash = a.getAttribute("href") ?? "";
			const isTop = hash === "#" || hash === "#top";
			const target = isTop ? document.body : targetFor(hash);
			if (!target) return;
			e.preventDefault();
			lenis.scrollTo(isTop ? 0 : anchorY(target), { force: true });
			history.pushState(null, "", hash);
			// Keep keyboard / screen-reader context in sync with where we scrolled.
			if (target !== document.body) {
				if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
				target.focus({ preventScroll: true });
			}
		};
		document.addEventListener("click", onClick);

		// Opening the page with #section: the browser jumps before pins exist and lands in the wrong place.
		// Re-scroll once ScrollTrigger has laid everything out.
		const initial = targetFor(window.location.hash);
		const onRefresh = () => {
			if (initial) lenis.scrollTo(anchorY(initial), { immediate: true, force: true });
		};
		if (initial) {
			if ("scrollRestoration" in history) history.scrollRestoration = "manual";
			ScrollTrigger.addEventListener("refresh", onRefresh);
			window.setTimeout(() => ScrollTrigger.removeEventListener("refresh", onRefresh), 4000);
		}

		return () => {
			document.removeEventListener("click", onClick);
			ScrollTrigger.removeEventListener("refresh", onRefresh);
			gsap.ticker.remove(tick);
			gsap.ticker.lagSmoothing(500, 33);
			lenis.destroy();
			if (window.__lenis === lenis) delete window.__lenis;
		};
	}, [reduced]);

	return null;
}
