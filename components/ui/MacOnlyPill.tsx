import clsx from "clsx";
import { MAC_ONLY } from "@/lib/copy";

/** Inline Mac laptop glyph (drawn here; no Apple logo). */
function LaptopGlyph() {
	return (
		<svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true" className="shrink-0">
			<rect x="3" y="1.25" width="12" height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
			<path d="M1 11.4h16c0 .9-.7 1.35-1.5 1.35h-13C1.7 12.75 1 12.3 1 11.4Z" fill="currentColor" />
		</svg>
	);
}

/**
 * "Only available for Mac" platform tag. `detail` adds the macOS version line after a hairline divider on ≥sm.
 * Uses neutral tokens, so it adapts to light, dark and .chapter-dark automatically.
 */
export function MacOnlyPill({ detail = false, className }: { detail?: boolean; className?: string }) {
	return (
		<span
			className={clsx(
				"t-caption inline-flex min-h-8 items-center gap-2 rounded-full border border-line px-3.5 py-1 text-fg-2",
				"bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] backdrop-blur-md backdrop-saturate-150",
				className,
			)}
		>
			<LaptopGlyph />
			<span className="text-fg">{MAC_ONLY.label}</span>
			{detail && (
				<>
					<span aria-hidden="true" className="hidden h-3.5 w-px bg-line sm:block" />
					<span className="hidden sm:inline">{MAC_ONLY.detail}</span>
				</>
			)}
		</span>
	);
}
