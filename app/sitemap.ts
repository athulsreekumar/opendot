import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Bump when the page content meaningfully changes. A fixed date beats "now", which would change on every request.
const LAST_MODIFIED = new Date("2026-10-05");

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{ url: `${SITE_URL}/`, lastModified: LAST_MODIFIED, changeFrequency: "weekly", priority: 1 },
		{ url: `${SITE_URL}/privacy`, lastModified: LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
	];
}
