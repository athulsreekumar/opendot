// STUB — replaced by T30 (real-time 3D Odi). Same public API; renders a placeholder sphere.
export type MascotPose = "hero" | "thinking" | "cheer" | "night" | "conductor" | "shield" | "envelope" | "peek";

export function Mascot({
	pose = "hero",
	size = 240,
	className,
	label,
}: {
	pose?: MascotPose;
	size?: number;
	className?: string;
	label?: string;
}) {
	return (
		<div
			role="img"
			aria-label={label ?? `Odi, the OpenDot mascot (${pose})`}
			className={className}
			style={{ width: size, height: size, display: "grid", placeItems: "center" }}
		>
			<div
				style={{
					width: "70%",
					height: "70%",
					borderRadius: "50%",
					background: "radial-gradient(circle at 35% 30%, #5eead4, #0e9f8a 60%, #0b7f70)",
				}}
			/>
		</div>
	);
}
