import type { MetadataRoute } from "next";
import { IS_PRODUCTION, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
	if (!IS_PRODUCTION) return { rules: { userAgent: "*", disallow: "/" } };
	return {
		rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev-"] },
		sitemap: `${SITE_URL}/sitemap.xml`,
		host: SITE_URL,
	};
}
