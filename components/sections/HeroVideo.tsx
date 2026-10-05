"use client";

import clsx from "clsx";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Screenshot } from "@/components/ui/Screenshot";

type Conn = { saveData?: boolean };

/**
 * The hero loop. The sidebar screenshot is always underneath (same 1440/900 box), so a missing/slow/blocked video
 * never shifts layout or shows a hole; the video fades in over it once it is actually playing.
 * Reduced motion / Save-Data: no autoplay, screenshot + round play button that opens the film.
 */
export function HeroVideo({ onPlayFilm, reduced }: { onPlayFilm: () => void; reduced: boolean }) {
	const [saveData, setSaveData] = useState(false);
	const [playing, setPlaying] = useState(false);
	const ref = useRef<HTMLVideoElement>(null);
	const still = reduced || saveData;

	useEffect(() => {
		setSaveData(!!(navigator as Navigator & { connection?: Conn }).connection?.saveData);
	}, []);

	// Pause when offscreen.
	useEffect(() => {
		const v = ref.current;
		if (!v || still) return;
		const io = new IntersectionObserver(
			([e]) => {
				if (!e) return;
				if (e.isIntersecting) v.play().catch(() => {});
				else v.pause();
			},
			{ threshold: 0.05 },
		);
		io.observe(v);
		return () => io.disconnect();
	}, [still]);

	return (
		<div className="relative size-full">
			<Screenshot
				name="sidebar-full"
				alt="OpenDot on a Mac: the sidebar with a team of Dots"
				priority
				sizes="(min-width: 1140px) 1100px, 100vw"
			/>
			{!still && (
				<video
					ref={ref}
					muted
					autoPlay
					loop
					playsInline
					preload="metadata"
					poster="/film/hero-loop-poster.jpg"
					aria-hidden="true"
					tabIndex={-1}
					onPlaying={() => setPlaying(true)}
					className={clsx(
						"absolute inset-0 size-full object-cover transition-opacity duration-500",
						playing ? "opacity-100" : "opacity-0",
					)}
				>
					<source src="/film/hero-loop.webm" type="video/webm" />
					<source src="/film/hero-loop-1080.mp4" type="video/mp4" />
				</video>
			)}
			{still && (
				<button
					type="button"
					onClick={onPlayFilm}
					aria-label="Play the film"
					className="absolute top-1/2 left-1/2 z-10 inline-flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-xl transition-transform duration-200 hover:scale-105 active:scale-95"
				>
					<Play size={30} fill="currentColor" strokeWidth={0} className="ml-1" />
				</button>
			)}
		</div>
	);
}
