import type { NextConfig } from "next";

// Vercel sets VERCEL_ENV to "production" | "preview" | "development". Anything but production must never be indexed.
const isProduction = (process.env.VERCEL_ENV ?? "production") === "production";

const config: NextConfig = {
	reactStrictMode: true,
	poweredByHeader: false,
	images: { formats: ["image/avif", "image/webp"] },
	async headers() {
		return [
			{
				source: "/film/:file*",
				headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
			},
			...(isProduction
				? []
				: [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }]),
		];
	},
};

export default config;
