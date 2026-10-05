import type { Metadata } from "next";
import { OG_ALT } from "@/lib/seo";

export const metadata: Metadata = {
	title: "Privacy",
	description: "What the OpenDot early-access list collects, why, where it lives and how to be removed.",
	alternates: { canonical: "/privacy" },
	openGraph: {
		type: "website",
		url: "/privacy",
		siteName: "OpenDot",
		locale: "en_US",
		title: "Privacy | OpenDot",
		description: "What the OpenDot early-access list collects, why, where it lives and how to be removed.",
		images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: OG_ALT }],
	},
};

const sections: { title: string; body: React.ReactNode }[] = [
	{
		title: "What we collect",
		body: (
			<>
				<p>
					When you join the early-access list we collect your email address. If you choose to tell us, we also store
					what your first Dot would do and which kind of Mac you have. We note which button you used, the time, your
					country (approximate, from your network) and your browser family so we can understand where interest comes
					from.
				</p>
				<p>The website does not use advertising trackers or third-party cookies.</p>
			</>
		),
	},
	{
		title: "Why",
		body: (
			<p>Only to tell you about OpenDot: launch updates and your early-access download. We never sell your data.</p>
		),
	},
	{
		title: "Where it lives",
		body: (
			<p>
				Your details are processed by Resend, which stores the list and sends our emails, and by Vercel, which hosts
				this website and receives your request. Both act as processors on our behalf.
			</p>
		),
	},
	{
		title: "How long we keep it",
		body: <p>Until twelve months after OpenDot launches, or until you ask to be removed, whichever comes first.</p>,
	},
	{
		title: "Removing yourself",
		body: (
			<p>
				Reply to any email from us, or use the unsubscribe link, and we will delete your details. You can also write to{" "}
				<a href="mailto:hello@opendot.live" className="underline underline-offset-4">
					hello@opendot.live
				</a>{" "}
				to ask what we hold about you or to have it corrected.
			</p>
		),
	},
];

export default function PrivacyPage() {
	return (
		<div className="container-text section-pad">
			<h1 className="t-display-m">Privacy</h1>
			<p className="t-body mt-6 opacity-70">
				The short version: we keep your email to tell you about OpenDot, and nothing else.
			</p>
			<div className="mt-16 flex flex-col gap-12">
				{sections.map((s) => (
					<section key={s.title} className="flex flex-col gap-3">
						<h2 className="t-title">{s.title}</h2>
						<div className="t-body flex max-w-[65ch] flex-col gap-4 opacity-85">{s.body}</div>
					</section>
				))}
			</div>
			<p className="t-caption mt-16 opacity-60">Questions: hello@opendot.live</p>
		</div>
	);
}
