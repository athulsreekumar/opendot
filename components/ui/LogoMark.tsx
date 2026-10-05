import { useId } from "react";

/** The app icon: teal rounded square with three white dots (same artwork as the app's build/icon.svg). */
export function LogoMark({ size = 22 }: { size?: number }) {
	const id = useId();
	return (
		<svg width={size} height={size} viewBox="64 64 896 896" aria-hidden="true" className="shrink-0">
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#16b39b" />
					<stop offset="1" stopColor="#0b7f70" />
				</linearGradient>
			</defs>
			<rect x="64" y="64" width="896" height="896" rx="200" fill={`url(#${id})`} />
			<circle cx="322" cy="560" r="78" fill="#fff" />
			<circle cx="512" cy="470" r="78" fill="#fff" />
			<circle cx="702" cy="560" r="78" fill="#fff" />
		</svg>
	);
}
