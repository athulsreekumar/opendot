import type { Metadata } from "next";
import { GITHUB_URL } from "@/lib/copy";
import { OG_ALT } from "@/lib/seo";

const DESCRIPTION =
	"OpenDot collects nothing about you. The website has no trackers, and the app keeps your data on your computer.";

export const metadata: Metadata = {
	title: "Privacy",
	description: DESCRIPTION,
	alternates: { canonical: "/privacy" },
	openGraph: {
		type: "website",
		url: "/privacy",
		siteName: "OpenDot",
		locale: "en_US",
		title: "Privacy | OpenDot",
		description: DESCRIPTION,
		images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: OG_ALT }],
	},
};

const sections: { title: string; body: React.ReactNode }[] = [
	{
		title: "This website",
		body: (
			<>
				<p>
					We don't collect anything about you here. There are no accounts, no forms, no analytics, no advertising
					trackers and no cookies.
				</p>
				<p>
					The site is hosted by Vercel, which, like any web host, briefly keeps standard server logs (such as IP address
					and browser) to run and protect the service.
				</p>
			</>
		),
	},
	{
		title: "The OpenDot app",
		body: (
			<>
				<p>
					Everything the app stores, from your Dots and chats to memory and settings, lives in a folder on your own
					computer. API keys and sign-in tokens are encrypted by your operating system. We never receive any of it.
				</p>
				<p>
					When a Dot uses a cloud model, the text it needs goes straight from your computer to the provider you chose,
					under that provider's terms. Personal details are masked first, and with a local model nothing leaves your
					computer at all.
				</p>
			</>
		),
	},
	{
		title: "Check it yourself",
		body: (
			<p>
				OpenDot is open source, so you can read exactly what it does in the{" "}
				<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
					source code on GitHub
				</a>
				.
			</p>
		),
	},
];

export default function PrivacyPage() {
	return (
		<div className="container-text section-pad">
			<h1 className="t-display-m">Privacy</h1>
			<p className="t-body mt-6 opacity-70">The short version: we don't collect anything about you.</p>
			<div className="mt-16 flex flex-col gap-12">
				{sections.map((s) => (
					<section key={s.title} className="flex flex-col gap-3">
						<h2 className="t-title">{s.title}</h2>
						<div className="t-body flex max-w-[65ch] flex-col gap-4 opacity-85">{s.body}</div>
					</section>
				))}
			</div>
			<p className="t-caption mt-16 opacity-60">
				Questions? Open an issue on{" "}
				<a
					href={`${GITHUB_URL}/issues`}
					target="_blank"
					rel="noopener noreferrer"
					className="underline underline-offset-4"
				>
					GitHub
				</a>
				.
			</p>
		</div>
	);
}
