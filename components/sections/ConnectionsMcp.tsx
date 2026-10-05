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
		<div ref={ref} className="pointer-events-none relative mt-6 flex min-h-[200px] flex-1 items-end md:min-h-[240px]">
			<div aria-hidden className="absolute inset-0 grid grid-cols-8 content-center gap-3 text-accent sm:gap-4">
				{Array.from({ length: GLYPHS }, (_, i) => (
					<span
						key={i}
						className="flex justify-center transition-[opacity,transform] duration-500 ease-out"
						style={{
							opacity: filled ? 0.14 : 0,
							transform: filled ? "scale(1)" : "scale(0.6)",
							transitionDelay: `${((i * 37) % GLYPHS) * 30}ms`,
						}}
					>
						<Icon as={Server} size={18} />
					</span>
				))}
			</div>
			<div
				className="relative font-semibold leading-none tracking-tight tabular-nums"
				style={{ fontSize: "clamp(88px, 12vw, 168px)" }}
			>
				<span className="sr-only">Unlimited</span>
				<span aria-hidden className={inf ? "text-gradient inline-block" : "inline-block text-fg"}>
					{inf ? "∞" : n}
				</span>
			</div>
		</div>
	);
}
