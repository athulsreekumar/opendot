"use client";

import { useCallback, useRef, useState } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { FilmDialog } from "@/components/site/FilmDialog";
import { Button } from "@/components/ui/Button";
import { GitHubButton } from "@/components/ui/GitHubButton";
import { MacOnlyPill } from "@/components/ui/MacOnlyPill";
import { MacWindow } from "@/components/ui/MacWindow";
import { hero } from "@/lib/copy";
import { openEarlyAccess } from "@/lib/early-access-client";
import { FEATURES } from "@/lib/features";
import "./hero.css";
import { HeroVideo } from "./HeroVideo";

export function Hero() {
	const reduced = useReducedMotion();
	const [film, setFilm] = useState(false);
	const openFilm = useCallback(() => setFilm(true), []);
	const closeFilm = useCallback(() => setFilm(false), []);

	const root = useRef<HTMLElement>(null);
	const text = useRef<HTMLDivElement>(null);
	const win = useRef<HTMLDivElement>(null);
	const glow = useRef<HTMLDivElement>(null);

	useGSAP(
		() => {
			const mm = gsap.matchMedia();
			mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
				const tl = gsap.timeline({
					defaults: { ease: "none" },
					scrollTrigger: {
						trigger: root.current,
						start: "top top",
						end: () => `+=${window.innerHeight}`,
						scrub: 0.8,
						invalidateOnRefresh: true,
					},
				});
				tl.fromTo(win.current, { scale: 0.86, y: 40, "--win-r": "20px" }, { scale: 1, y: 0, "--win-r": "12px" }, 0)
					.fromTo(glow.current, { opacity: 0.25, scale: 0.8 }, { opacity: 1, scale: 1.1 }, 0)
					.to(text.current, { y: -60, opacity: 0.2 }, 0);
			});
			return () => mm.revert();
		},
		{ scope: root },
	);

	return (
		<section id="hero" ref={root} className="relative overflow-x-clip pb-16 md:pb-24">
			<div
				ref={text}
				className="container-site flex min-h-[calc(100svh-120px)] flex-col items-center justify-center pt-[calc(52px+40px)] pb-10 text-center md:min-h-[calc(100svh-140px)]"
			>
				<div className="hero-in" style={{ "--i": 0 } as React.CSSProperties}>
					<MacOnlyPill detail />
				</div>
				<h1 className="t-display-xl mt-6 max-w-[18ch] md:mt-8">
					<span className="hero-in block" style={{ "--i": 1 } as React.CSSProperties}>
						{hero.h1[0]}
					</span>
					<span className="hero-in text-gradient block" style={{ "--i": 2 } as React.CSSProperties}>
						{hero.h1[1]}
					</span>
				</h1>
				<p className="t-lead hero-in mt-6 max-w-[38ch] text-fg-2 md:mt-8" style={{ "--i": 3 } as React.CSSProperties}>
					{hero.lead}
				</p>
				<div
					className="hero-in mt-8 flex flex-col items-center gap-2 sm:flex-row sm:gap-6 md:mt-10"
					style={{ "--i": 4 } as React.CSSProperties}
				>
					{FEATURES.earlyAccess ? (
						<Button size="lg" onClick={() => openEarlyAccess("hero")}>
							{hero.cta}
						</Button>
					) : (
						<GitHubButton>{hero.cta}</GitHubButton>
					)}
					<Button variant="secondary" size="lg" href="/download">
						{hero.build}
					</Button>
					{FEATURES.film && (
						<Button variant="secondary" size="lg" onClick={openFilm}>
							{hero.film}
						</Button>
					)}
				</div>
			</div>

			<div className="container-site relative">
				<div
					ref={glow}
					aria-hidden="true"
					className="hero-glow pointer-events-none absolute top-[8%] left-1/2 aspect-[16/10] w-[min(1300px,130%)] -translate-x-1/2 rounded-full"
				/>
				<div className="hero-in relative mx-auto max-w-[1100px]" style={{ "--i": 6 } as React.CSSProperties}>
					<MacWindow ref={win} className="hero-window">
						<HeroVideo onPlayFilm={FEATURES.film ? openFilm : undefined} reduced={reduced} />
					</MacWindow>
				</div>
				<p className="t-caption mt-6 text-center text-fg-3">{hero.underVideo}</p>
			</div>

			{FEATURES.film && <FilmDialog open={film} onClose={closeFilm} />}
		</section>
	);
}
