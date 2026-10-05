import type { NextConfig } from "next";

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
		];
	},
};

export default config;
