import clsx from "clsx";
import { type CSSProperties, forwardRef, type ReactNode } from "react";

export type MacWindowProps = {
	children: ReactNode;
	/** Corner radius in px (default 12). */
	radius?: number;
	/** Content aspect ratio (default 1440/900). Pass "auto" to let the content decide the height. */
	aspect?: number | "auto";
	/** Optional centered window title; adds a translucent titlebar strip. Omit for a hiddenInset window. */
	title?: string;
	className?: string;
	style?: CSSProperties;
};

const lights = [
	{ c: "#ff5f57", n: "close" },
	{ c: "#febc2e", n: "minimize" },
	{ c: "#28c840", n: "zoom" },
];

/**
 * macOS window frame for screenshots / video. The traffic lights float over the top-left of the content
 * (the app is a hiddenInset window with no titlebar of its own). Forwards its ref to the outer element for GSAP.
 */
export const MacWindow = forwardRef<HTMLDivElement, MacWindowProps>(function MacWindow(
	{ children, radius = 12, aspect = 1440 / 900, title, className, style },
	ref,
) {
	return (
		<div
			ref={ref}
			className={clsx("relative isolate overflow-hidden bg-card shadow-window", className)}
			style={{
				borderRadius: radius,
				aspectRatio: aspect === "auto" ? undefined : aspect,
				...style,
			}}
		>
			<div
				className={clsx(
					aspect === "auto" ? "relative" : "absolute inset-0",
					"[&>img]:block [&>img]:size-full [&>video]:block [&>video]:size-full [&>video]:object-cover [&>*]:size-full",
				)}
			>
				{children}
			</div>
			<div
				className={clsx(
					"pointer-events-none absolute inset-x-0 top-0 z-10 flex h-7 items-center",
					title &&
						"border-b border-line bg-[color-mix(in_srgb,var(--card)_72%,transparent)] backdrop-blur-xl backdrop-saturate-150",
				)}
			>
				<div className="flex gap-2 pl-[13px]" aria-hidden="true">
					{lights.map((l) => (
						<span
							key={l.n}
							className="size-3 rounded-full"
							style={{ background: l.c, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.18)" }}
						/>
					))}
				</div>
				{title && (
					<span className="absolute inset-x-20 truncate text-center text-[12px] font-medium text-fg-2">{title}</span>
				)}
			</div>
			{/* Hairline border drawn above the content so screenshots can't cover it. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-20 border border-line"
				style={{ borderRadius: radius }}
			/>
		</div>
	);
});
