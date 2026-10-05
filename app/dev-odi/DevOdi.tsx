"use client";

import { useState } from "react";
import OdiScene from "@/components/mascot/OdiScene";
import { POSE_NAMES, type PoseName } from "@/components/mascot/poses";
import { Mascot } from "@/components/ui/Mascot";

declare global {
	interface Window {
		__odiReady?: boolean;
	}
}

function RenderMode({ render, size }: { render: PoseName | "head"; size: number }) {
	return (
		<>
			<style>{`html,body{background:transparent!important}body>:not(main){display:none!important}main{padding:0!important}`}</style>
			<div id="odi-render" style={{ position: "fixed", left: 0, top: 0, width: size, height: size, zIndex: 99999 }}>
				<OdiScene
					pose={render === "head" ? "hero" : render}
					view={render === "head" ? "head" : "full"}
					still
					onReady={() => {
						window.setTimeout(() => {
							window.__odiReady = true;
						}, 1500);
					}}
				/>
			</div>
		</>
	);
}

export function DevOdi({ render, size }: { render: PoseName | "head" | null; size: number }) {
	const [pose, setPose] = useState<PoseName>("hero");
	if (render) return <RenderMode render={render} size={size} />;
	const next = () => setPose((p) => POSE_NAMES[(POSE_NAMES.indexOf(p) + 1) % POSE_NAMES.length] ?? "hero");
	return (
		<div className="mx-auto max-w-[1360px] px-6 py-24">
			<h1 className="text-3xl font-semibold">Odi showcase</h1>
			<p className="mt-2 text-fg-2">Dev only. Cursor tracking, blinking and idle float are live.</p>

			<section className="mt-10 grid items-center gap-10 rounded-3xl bg-bg-alt p-8 md:grid-cols-[auto_1fr]">
				<Mascot pose={pose} size={460} />
				<div>
					<p className="text-fg-2 text-sm uppercase tracking-wider">Pose switcher (transition demo)</p>
					<p className="mt-1 font-semibold text-2xl">{pose}</p>
					<div className="mt-4 flex flex-wrap gap-2">
						<button
							type="button"
							onClick={next}
							className="rounded-full bg-accent px-5 py-2 font-medium text-accent-fg"
						>
							Next pose
						</button>
						{POSE_NAMES.map((n) => (
							<button
								key={n}
								type="button"
								onClick={() => setPose(n)}
								aria-pressed={pose === n}
								className="rounded-full border border-line px-4 py-2 text-sm aria-pressed:bg-fg aria-pressed:text-bg"
							>
								{n}
							</button>
						))}
					</div>
				</div>
			</section>

			<Grid title="Light" bg="#ffffff" fg="#1d1d1f" />
			<Grid title="Dark" bg="#000000" fg="#f5f5f7" />
			<Grid title="Small (160px)" bg="#f5f5f7" fg="#1d1d1f" size={160} />
		</div>
	);
}

function Grid({ title, bg, fg, size = 300 }: { title: string; bg: string; fg: string; size?: number }) {
	return (
		<section className="mt-10 rounded-3xl p-8" style={{ background: bg, color: fg }}>
			<h2 className="font-semibold text-xl">{title}</h2>
			<div className="mt-6 flex flex-wrap gap-6">
				{POSE_NAMES.map((n) => (
					<figure key={n} className="m-0 text-center">
						<Mascot pose={n} size={size} />
						<figcaption className="text-sm opacity-70">{n}</figcaption>
					</figure>
				))}
			</div>
		</section>
	);
}
