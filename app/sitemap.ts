import type { MetadataRoute } from "next";
import { CONTENT_PAGES } from "@/lib/pages";
import { pageImageUrl } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

// Bump when the page content meaningfully changes. A fixed date beats "now", which would change on every request.
const LAST_MODIFIED = new Date("2026-10-07");

const PRIORITY = { hub: 0.8, feature: 0.8, guide: 0.7, download: 0.9 } as const;

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: `${SITE_URL}/`,
			lastModified: LAST_MODIFIED,
			changeFrequency: "weekly",
			priority: 1,
			images: [
				`${SITE_URL}/shots/org-board-light@2x.webp`,
				`${SITE_URL}/shots/sidebar-full-light@2x.webp`,
				`${SITE_URL}/shots/superbot-answer-light@2x.webp`,
			],
		},
		...CONTENT_PAGES.map((p) => ({
			url: `${SITE_URL}${p.path}`,
			lastModified: LAST_MODIFIED,
			changeFrequency: (p.kind === "guide" ? "monthly" : "weekly") as "monthly" | "weekly",
			priority: PRIORITY[p.kind],
			images: [pageImageUrl(p)],
		})),
		{ url: `${SITE_URL}/privacy`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
	];
}
