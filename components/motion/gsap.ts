"use client";

// Single place that registers GSAP plugins. Import gsap / ScrollTrigger / useGSAP from here, never from "gsap".
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/** True when the user asked the OS/browser for reduced motion. Always false on the server. */
export function prefersReducedMotion(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger, useGSAP };
