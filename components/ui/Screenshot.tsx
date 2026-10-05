"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

export type ScreenshotProps = {
	/** File stem in /public/shots, e.g. "sidebar-full" → /shots/sidebar-full-dark@2x.avif … */
	name: string;
	/** Descriptive alt text (required — screenshots carry meaning). */
	alt: string;
	/** Above-the-fold image: eager + high fetch priority. */
	priority?: boolean;
	/** `sizes` attribute (default: full viewport width). */
	sizes?: string;
	/** Force a theme variant. Default follows prefers-color-scheme. Dark chapters pass "dark". */
	theme?: "light" | "dark";
	className?: string;
};

const W = 2880;
const H = 1800;
const src = (name: string, theme: string, ext: string) => `/shots/${name}-${theme}@2x.${ext}`;

/**
 * Theme-aware app screenshot (2880×1800 @2x) as <picture> with AVIF + WebP. Fills its parent's width, keeps a fixed
 * 8:5 box with a neutral background so a missing file never shifts layout.
 */
export function Screenshot({ name, alt, priority = false, sizes = "100vw", theme, className }: ScreenshotProps) {
	const [failed, setFailed] = useState(false);
	const img = useRef<HTMLImageElement>(null);

	// An error can fire before hydration attaches onError; catch that case too.
	useEffect(() => {
		const el = img.current;
		if (el?.complete && el.naturalWidth === 0) setFailed(true);
	}, []);

	const themes = theme ? [theme] : (["dark", "light"] as const);
	const fallbackTheme = theme ?? "light";

	return (
		<div
			className={clsx("relative size-full overflow-hidden bg-bg-alt", className)}
			style={{ aspectRatio: `${W} / ${H}`, borderRadius: "inherit" }}
		>
			<picture>
				{themes.flatMap((t) =>
					(["avif", "webp"] as const).map((ext) => (
						<source
							key={`${t}-${ext}`}
							type={`image/${ext}`}
							srcSet={src(name, t, ext)}
							sizes={sizes}
							media={theme ? undefined : t === "dark" ? "(prefers-color-scheme: dark)" : undefined}
						/>
					)),
				)}
				<img
					ref={img}
					src={src(name, fallbackTheme, "webp")}
					alt={alt}
					width={W}
					height={H}
					sizes={sizes}
					loading={priority ? "eager" : "lazy"}
					fetchPriority={priority ? "high" : "auto"}
					decoding="async"
					onError={() => setFailed(true)}
					className={clsx("block size-full object-cover transition-opacity duration-300", failed && "opacity-0")}
					style={{ borderRadius: "inherit" }}
				/>
			</picture>
		</div>
	);
}
