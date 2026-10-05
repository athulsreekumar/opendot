"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { POSES, type PoseName } from "@/components/mascot/poses";

// The 3D chunk (three + fiber + drei) is only fetched once a Mascot is near the viewport.
const OdiScene = dynamic(() => import("@/components/mascot/OdiScene"), { ssr: false });

export type MascotPose = PoseName;

export interface MascotProps {
	pose?: PoseName;
	/** CSS pixel size of the (square) box. */
	size?: number;
	className?: string;
	/** Accessible label; defaults to a description of the pose. */
	label?: string;
	/** Always use the pre-rendered image (no WebGL). For small, short-lived spots like dialogs and toasts. */
	still?: boolean;
}

let webglOk: boolean | null = null;
function hasWebGL() {
	if (webglOk !== null) return webglOk;
	try {
		const c = document.createElement("canvas");
		const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
		webglOk = !!gl;
		gl?.getExtension("WEBGL_lose_context")?.loseContext();
	} catch {
		webglOk = false;
	}
	return webglOk;
}

/**
 * Odi, the OpenDot mascot. Renders a fixed-size box immediately (no layout shift), mounts the WebGL canvas
 * when within ~1 viewport and unmounts it again beyond ~2 viewports to release the GL context.
 * Without WebGL it shows /mascot/odi-<pose>.png (or a soft teal circle if that file is missing).
 */
export function Mascot({ pose = "hero", size = 240, className, label, still = false }: MascotProps) {
	const box = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);
	const [gl, setGl] = useState<boolean | null>(null);
	const [ready, setReady] = useState(false);
	const [failedPose, setFailedPose] = useState<PoseName | null>(null);
	const imgFailed = failedPose === pose;

	useEffect(() => {
		const el = box.current;
		if (!el) return;
		if (still) {
			setGl(false);
			return;
		}
		setGl(hasWebGL());
		const near = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setMounted(true), {
			rootMargin: "100% 0px 100% 0px",
		});
		const far = new IntersectionObserver(
			(e) => {
				if (e.every((x) => !x.isIntersecting)) {
					setMounted(false);
					setReady(false);
				}
			},
			{ rootMargin: "200% 0px 200% 0px" },
		);
		near.observe(el);
		far.observe(el);
		return () => {
			near.disconnect();
			far.disconnect();
		};
	}, [still]);

	const aria = label ?? POSES[pose].label;
	const poster = `/mascot/odi-${pose}.webp`;
	const showCanvas = mounted && gl === true;
	const showImg = !imgFailed && (gl === false || !ready);

	return (
		<div
			ref={box}
			role="img"
			aria-label={aria}
			className={className}
			style={{ position: "relative", width: size, height: size, flex: "none", contain: "layout paint" }}
		>
			{imgFailed && !showCanvas ? (
				<div
					aria-hidden
					style={{
						position: "absolute",
						inset: "18%",
						borderRadius: "50%",
						background: "radial-gradient(circle at 35% 30%, #5eead4, #0e9f8a 60%, #0b7f70)",
						opacity: 0.85,
					}}
				/>
			) : (
				showImg && (
					// biome-ignore lint/performance/noImgElement: static fallback poster, decorative
					<img
						src={poster}
						alt=""
						aria-hidden
						width={size}
						height={size}
						loading="lazy"
						fetchPriority="low"
						decoding="async"
						draggable={false}
						onError={() => setFailedPose(pose)}
						style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
					/>
				)
			)}
			{showCanvas && (
				<div
					aria-hidden
					style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 300ms ease-out" }}
				>
					<OdiScene pose={pose} onReady={() => setReady(true)} />
				</div>
			)}
		</div>
	);
}

export default Mascot;
