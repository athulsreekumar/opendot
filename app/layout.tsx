import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { EarlyAccessDialog } from "@/components/site/EarlyAccessDialog";
import { Footer } from "@/components/site/Footer";
import { Nav } from "@/components/site/Nav";
import { meta } from "@/lib/copy";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: meta.title,
	description: meta.description,
	alternates: { canonical: "/" },
	openGraph: { title: meta.title, description: meta.description, url: "/", siteName: "OpenDot", type: "website" },
	twitter: { card: "summary_large_image", title: meta.title, description: meta.description },
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
