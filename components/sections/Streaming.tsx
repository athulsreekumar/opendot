"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { streaming as copy } from "@/lib/copy";

const TOKEN_RE = /\n|[\p{L}\p{N}’']+ ?|[^\s\p{L}\p{N}] ?/gu;
const TPS = 40;
const FIRST_TOKEN_MS = 120;

/** Renders text with "• " lines as a list and blank-line separated paragraphs. */
function renderAnswer(text: string, caret?: boolean): ReactNode {
	const lines = text.split("\n");
	const out: ReactNode[] = [];
	let items: string[] = [];
	const flush = (k: number) => {
		if (items.length) {
			out.push(
				<ul key={`ul${k}`} className="my-2 list-disc space-y-1.5 pl-5">
					{items.map((t, j) => (
						<li key={j}>{t}</li>
					))}
				</ul>,
			);
			items = [];
		}
	};
	lines.forEach((line, i) => {
		if (line.startsWith("•")) items.push(line.replace(/^•\s?/, ""));
		else {
			flush(i);
			if (line.trim()) out.push(<p key={`p${i}`}>{line}</p>);
		}
	});
	flush(lines.length);
	return (
		<>
			{out}
			{caret && <span aria-hidden className="stream-caret" />}
		</>
	);
}

export function Streaming() {
	const reduced = useReducedMotion();
	const cardRef = useRef<HTMLDivElement>(null);
	const tokens = useMemo(() => copy.demoAnswer.match(TOKEN_RE) ?? [], []);
	const [count, setCount] = useState(tokens.length);
	const [elapsed, setElapsed] = useState<number | null>(null);
	const [armed, setArmed] = useState(false);

	// Once mounted on the client with motion allowed, start from empty so it can stream.
	useEffect(() => {
		if (reduced) return;
		setCount(0);
		setArmed(true);
	}, [reduced]);

	useEffect(() => {
		const el = cardRef.current;
		if (!el || reduced || !armed) return;
		let raf = 0;
		let running = false;
		const stop = () => {
			cancelAnimationFrame(raf);
			running = false;
		};
		const start = () => {
			if (running) return;
			running = true;
			const t0 = performance.now();
			const tick = (now: number) => {
				const ms = now - t0;
				const n = Math.min(tokens.length, Math.max(0, Math.floor(((ms - FIRST_TOKEN_MS) * TPS) / 1000) + 1));
				setCount(n);
				if (n >= tokens.length) {
					setElapsed(ms);
					running = false;
					return;
				}
				raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		};
		const io = new IntersectionObserver(
			(entries) => {
				const e = entries[entries.length - 1];
				if (!e) return;
				if (e.intersectionRatio >= 0.5) start();
				else if (e.intersectionRatio === 0) {
					stop();
					setCount(0);
					setElapsed(null);
				}
			},
			{ threshold: [0, 0.5] },
		);
		io.observe(el);
		return () => {
			io.disconnect();
			stop();
		};
	}, [reduced, armed, tokens]);

	const done = count >= tokens.length;
	const partial = tokens.slice(0, count).join("");
	const status = done ? (elapsed ? `${(elapsed / 1000).toFixed(1)}s` : "done") : count > 0 ? "streaming…" : "waiting…";

	return (
		<section id="streaming" className="chapter-light section-pad">
			<div className="container-site grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
				<Reveal>
					<p className="t-caption mb-4 font-semibold uppercase tracking-[0.14em] text-accent">{copy.eyebrow}</p>
					<h2 className="t-display-l">{copy.h2.join(" ")}</h2>
					<p className="t-lead mt-5 max-w-lg text-fg-2">{copy.lead}</p>
				</Reveal>

				<Reveal y={32}>
					<div
						ref={cardRef}
						className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-line shadow-window"
						style={{ background: "#f4f1ea", color: "#1d2a27" }}
					>
						<div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
							<span className="text-[13px] font-semibold">Dot</span>
							<span className="flex items-center gap-2 text-[12px] opacity-70" aria-hidden>
								<span className="rounded-full bg-white/80 px-2 py-0.5">first token {FIRST_TOKEN_MS}ms</span>
								<span className="tabular-nums" data-testid="stream-status">
									{status}
								</span>
							</span>
						</div>
						<div className="space-y-4 p-5 sm:p-6">
							<div className="flex justify-end">
								<p
									className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px]"
									style={{ background: "#d7f3ea" }}
								>
									{copy.demoQuestion}
								</p>
							</div>
							<div className="flex items-start gap-3">
								<span
									aria-hidden
									className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-base shadow-card"
								>
									📬
								</span>
								<div className="relative min-w-0 rounded-2xl rounded-tl-md bg-white px-4 py-3 text-[15px] leading-relaxed shadow-card">
									<span className="sr-only">{copy.demoAnswer}</span>
									{/* Invisible full text reserves the final height; streamed text overlays it. */}
									<div aria-hidden className="invisible space-y-2">
										{renderAnswer(copy.demoAnswer)}
									</div>
									<div aria-hidden className="absolute inset-0 space-y-2 px-4 py-3">
										{renderAnswer(partial, !done)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</Reveal>
			</div>
			<style>{`
				.stream-caret{display:inline-block;width:2px;height:1.1em;margin-left:2px;vertical-align:text-bottom;background:var(--accent);animation:stream-blink 1s steps(1) infinite}
				@keyframes stream-blink{50%{opacity:0}}
				@media (prefers-reduced-motion: reduce){.stream-caret{animation:none}}
			`}</style>
		</section>
	);
}
