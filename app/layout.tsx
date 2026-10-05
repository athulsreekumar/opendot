import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { EarlyAccessDialog } from "@/components/site/EarlyAccessDialog";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { OG_ALT, SEO_DESCRIPTION, SEO_KEYWORDS } from "@/lib/seo";
import { IS_PRODUCTION, SITE_URL } from "@/lib/site";

const TITLE = "OpenDot: your AI team, living on your Mac";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: { default: TITLE, template: "%s | OpenDot" },
	description: SEO_DESCRIPTION,
	keywords: SEO_KEYWORDS,
	applicationName: "OpenDot",
	authors: [{ name: "OpenDot", url: SITE_URL }],
	creator: "OpenDot",
	publisher: "OpenDot",
	category: "productivity",
	alternates: { canonical: "/" },
	// Only the production deployment may be indexed; Vercel previews must never compete with the real site.
	robots: IS_PRODUCTION
		? {
				index: true,
				follow: true,
				googleBot: {
					index: true,
					follow: true,
					"max-image-preview": "large",
					"max-snippet": -1,
					"max-video-preview": -1,
				},
			}
		: { index: false, follow: false, nocache: true },
	openGraph: {
		type: "website",
		url: "/",
		siteName: "OpenDot",
		locale: "en_US",
		title: TITLE,
		description: SEO_DESCRIPTION,
		images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: OG_ALT }],
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: SEO_DESCRIPTION,
		images: [{ url: "/twitter-image", width: 1200, height: 630, alt: OG_ALT }],
	},
	manifest: "/manifest.webmanifest",
	formatDetection: { email: false, address: false, telephone: false },
	verification: {
		google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
		yandex: process.env.YANDEX_VERIFICATION || undefined,
		other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#000000" },
	],
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
				>
					Skip to content
				</a>
				<SmoothScroll />
				<Nav />
				<main id="main">{children}</main>
				<Footer />
				<EarlyAccessDialog />
			</body>
		</html>
	);
}
