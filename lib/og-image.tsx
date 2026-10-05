import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hero, MAC_ONLY } from "@/lib/copy";
import { OG_ALT } from "@/lib/seo";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export { OG_ALT };

/** Shared by app/opengraph-image.tsx and app/twitter-image.tsx. Inter is bundled in /assets (static TTFs from @fontsource-variable/inter). */
export async function renderOgImage() {
	const root = process.cwd();
	const [bold, medium, odi] = await Promise.all([
		readFile(join(root, "assets/Inter-Bold.ttf")),
		readFile(join(root, "assets/Inter-Medium.ttf")),
		readFile(join(root, "public/mascot/odi-hero.png")),
	]);
	const odiSrc = `data:image/png;base64,${odi.toString("base64")}`;

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				position: "relative",
				background: "#000",
				color: "#f5f5f7",
				fontFamily: "Inter",
			}}
		>
			<div
				style={{
					position: "absolute",
					right: -120,
					top: -60,
					width: 900,
					height: 900,
					display: "flex",
					background:
						"radial-gradient(circle at center, rgba(45,212,191,0.38) 0%, rgba(14,159,138,0.14) 42%, rgba(0,0,0,0) 68%)",
				}}
			/>
			{/* biome-ignore lint/performance/noImgElement: next/og renders plain elements */}
			<img
				src={odiSrc}
				alt=""
				width={600}
				height={417}
				style={{ position: "absolute", right: 16, bottom: 0, width: 600, height: 417, objectFit: "contain" }}
			/>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					bottom: 0,
					height: 140,
					display: "flex",
					background: "linear-gradient(to bottom, rgba(0,0,0,0), #000 85%)",
				}}
			/>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					padding: "64px 72px",
					width: 790,
					height: "100%",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 18 }}>
					<svg width="64" height="64" viewBox="64 64 896 896" role="img" aria-label="OpenDot logo">
						<defs>
							<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0" stopColor="#16b39b" />
								<stop offset="1" stopColor="#0b7f70" />
							</linearGradient>
						</defs>
						<rect x="64" y="64" width="896" height="896" rx="200" fill="url(#g)" />
						<circle cx="322" cy="560" r="78" fill="#fff" />
						<circle cx="512" cy="470" r="78" fill="#fff" />
						<circle cx="702" cy="560" r="78" fill="#fff" />
					</svg>
					<div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.2, display: "flex" }}>OpenDot</div>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						fontSize: 70,
						fontWeight: 700,
						letterSpacing: -2.4,
						lineHeight: 1.02,
					}}
				>
					<div style={{ display: "flex" }}>{hero.h1[0]}</div>
					<div style={{ display: "flex", color: "#2dd4bf" }}>{hero.h1[1]}</div>
				</div>
				<div style={{ display: "flex" }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							padding: "12px 26px",
							borderRadius: 999,
							border: "1.5px solid rgba(255,255,255,0.22)",
							background: "rgba(255,255,255,0.07)",
							fontSize: 26,
							fontWeight: 500,
							color: "#f5f5f7",
						}}
					>
						{MAC_ONLY.label}
					</div>
				</div>
			</div>
		</div>,
		{
			...OG_SIZE,
			fonts: [
				{ name: "Inter", data: bold, weight: 700, style: "normal" },
				{ name: "Inter", data: medium, weight: 500, style: "normal" },
			],
		},
	);
}
