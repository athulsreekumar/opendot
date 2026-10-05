import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Mascot } from "@/components/ui/Mascot";
import { CONTENT_PAGES } from "@/lib/pages";

export const metadata: Metadata = {
	title: "Page not found",
	description: "That page does not exist. Try the OpenDot home page, features, guides or download.",
	robots: { index: false, follow: true },
};

export default function NotFound() {
	const links = CONTENT_PAGES.filter((p) => p.kind !== "hub");
	return (
		<section className="chapter-light bg-bg text-fg">
			<div className="container-text flex flex-col items-center pt-[calc(52px+4rem)] pb-24 text-center md:pb-32">
				<Mascot pose="peek" size={140} still />
				<p className="t-caption mt-6 font-semibold tracking-[0.04em] text-accent uppercase">Error 404</p>
				<h1 className="t-display-m mt-3">This page wandered off.</h1>
				<p className="t-lead mt-5 max-w-[36ch] text-fg-2">
					We could not find what you were looking for. Here is where most people want to go.
				</p>
				<div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
					<Button size="lg" href="/">
						Back to OpenDot
					</Button>
					<Button variant="secondary" size="lg" href="/download">
						Download
					</Button>
				</div>
				<ul className="mt-14 grid w-full gap-2 text-left sm:grid-cols-2">
					{links.map((p) => (
						<li key={p.path}>
							<a
								href={p.path}
								className="t-body block rounded-xl border border-line px-4 py-3 transition-colors duration-200 hover:border-accent hover:text-accent"
							>
								{p.title}
							</a>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
