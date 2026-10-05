"use client";

import { Server } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { Icon } from "@/components/ui/Icon";

const GLYPHS = 40;

/** Counter that ticks 1, 2, 3 … then morphs to ∞ when scrolled into view, with a grid of server glyphs filling in. */
export function ConnectionsMcp() {
	const ref = useRef<HTMLDivElement>(null);
	const reduced = useReducedMotion();
	const [n, setN] = useState<number | "inf">("inf");
	const [filled, setFilled] = useState(true);

	useEffect(() => {
		const el = ref.current;
		if (!el || reduced) return;
		setN(0);
		setFilled(false);
		let raf = 0;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				io.disconnect();
				setFilled(true);
				const t0 = performance.now();
				const steps = 12;
				const dur = 1400;
				const tick = (now: number) => {
					const p = Math.min(1, (now - t0) / dur);
					// ease-in: slow start, speeding up
					const v = Math.max(1, Math.ceil(p * p * steps));
					if (p >= 1) setN("inf");
					else {
						setN(v);
						raf = requestAnimationFrame(tick);
					}
				};
				raf = requestAnimationFrame(tick);
			},
			{ threshold: 0.4 },
		);
		io.observe(el);
		return () => {
			io.disconnect();
			cancelAnimationFrame(raf);
		};
	}, [reduced]);

	const inf = n === "inf";
	return (
		<div
			ref={ref}
			className="pointer-events-none relative mt-6 flex min-h-[240px] flex-1 items-center justify-center md:min-h-[300px] md:justify-end"
		>
			<div
				aria-hidden
				className="absolute inset-0 grid grid-cols-5 content-center gap-4 text-accent [--mx:50%] sm:grid-cols-8 md:[--mx:76%]"
				style={{
					WebkitMaskImage:
						"radial-gradient(ellipse 70% 75% at var(--mx) 50%, transparent 0%, transparent 26%, #000 55%, transparent 100%)",
					maskImage:
						"radial-gradient(ellipse 70% 75% at var(--mx) 50%, transparent 0%, transparent 26%, #000 55%, transparent 100%)",
				}}
			>
				{Array.from({ length: GLYPHS }, (_, i) => (
					<span
						key={i}
						className="flex justify-center transition-[opacity,transform] duration-500 ease-out"
						style={{
							opacity: filled ? 0.3 : 0,
							transform: filled ? "scale(1)" : "scale(0.6)",
							transitionDelay: `${((i * 37) % GLYPHS) * 30}ms`,
						}}
					>
						<Icon as={Server} size={18} />
					</span>
				))}
			</div>
			<div
				className="relative font-semibold leading-none tracking-tight tabular-nums md:pr-8"
				style={{ fontSize: "clamp(140px, 20vw, 260px)" }}
			>
				<span className="sr-only">Unlimited</span>
				<span aria-hidden className={inf ? "text-gradient inline-block" : "inline-block text-fg"}>
					{inf ? "∞" : n}
				</span>
			</div>
		</div>
	);
}
