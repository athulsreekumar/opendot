import type { MetadataRoute } from "next";
import { SEO_DESCRIPTION } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "OpenDot",
		short_name: "OpenDot",
		description: SEO_DESCRIPTION,
		start_url: "/",
		scope: "/",
		display: "browser",
		background_color: "#000000",
		theme_color: "#0e9f8a",
		categories: ["productivity", "utilities"],
		lang: "en",
		icons: [
			{ src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
		],
	};
}
