import { ChevronRight, Plus } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/Button";
import { MacWindow } from "@/components/ui/MacWindow";
import { Mascot } from "@/components/ui/Mascot";
import { Screenshot } from "@/components/ui/Screenshot";
import { GITHUB_URL } from "@/lib/copy";
import { type Block, type ContentPage, pageByPath } from "@/lib/pages";
import { breadcrumbs, pageJsonLd } from "@/lib/seo";
import "@/components/sections/faq.css";
import { EarlyAccessButton } from "./EarlyAccessButton";

const H2 = "text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-balance";

function Steps({ steps }: { steps: NonNullable<Block["steps"]> }) {
	return (
		<ol className="mt-8 flex flex-col gap-6">
			{steps.map((s, i) => (
				<li key={s.title} className="flex gap-4">
					<span
						aria-hidden="true"
						className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-accent-fg"
					>
						{i + 1}
					</span>
					<div className="min-w-0 flex-1">
						<h3 className="t-title !text-[1.25rem]">{s.title}</h3>
						<p className="t-body mt-1.5 text-fg-2">{s.body}</p>
						{s.code && <Code>{s.code}</Code>}
					</div>
				</li>
			))}
		</ol>
	);
}

function Code({ children }: { children: string }) {
	return (
		<pre className="mt-3 max-w-full overflow-x-auto rounded-xl border border-line bg-bg-alt px-4 py-3 font-mono text-[13.5px] leading-relaxed text-fg">
			<code>{children}</code>
		</pre>
	);
}

function BlockView({ block }: { block: Block }) {
	return (
		<section className="mt-16 md:mt-20">
			<h2 className={H2}>{block.h2}</h2>
			{block.p?.map((t) => (
				<p key={t.slice(0, 40)} className="t-body mt-5 text-fg-2">
					{t}
				</p>
			))}
			{block.list && (
				<ul className="t-body mt-5 flex list-disc flex-col gap-2 pl-5 text-fg-2 marker:text-accent">
					{block.list.map((t) => (
						<li key={t}>{t}</li>
					))}
				</ul>
			)}
			{block.steps && <Steps steps={block.steps} />}
			{block.code && <Code>{block.code}</Code>}
			{block.shot && (
				<figure className="mt-8">
					<MacWindow radius={12}>
						<Screenshot
							name={block.shot.name}
							alt={block.shot.alt}
							theme="light"
							sizes="(min-width: 800px) 760px, 100vw"
						/>
					</MacWindow>
					{block.shot.caption && (
						<figcaption className="t-caption mt-3 text-center text-fg-3">{block.shot.caption}</figcaption>
					)}
				</figure>
			)}
		</section>
	);
}

function Related({ page }: { page: ContentPage }) {
	const items = page.related.map(pageByPath).filter((p): p is ContentPage => !!p);
	if (!items.length) return null;
	return (
		<section className="mt-20" aria-labelledby="related-title">
			<h2 id="related-title" className={H2}>
				Keep reading
			</h2>
			<ul className="mt-6 grid gap-3 sm:grid-cols-2">
				{items.map((p) => (
					<li key={p.path}>
						<a
							href={p.path}
							className="group flex h-full flex-col rounded-2xl border border-line bg-card p-5 transition-colors duration-200 hover:border-accent"
						>
							<span className="t-caption text-accent">{p.eyebrow}</span>
							<span className="mt-1 text-[17px] leading-snug font-semibold tracking-[-0.01em]">{p.title}</span>
							<span className="t-caption mt-2 inline-flex items-center text-fg-3 group-hover:text-accent">
								Read more <ChevronRight aria-hidden="true" size={15} />
							</span>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}

/** Server-rendered template for feature pages, guides, the download page and the two hubs. */
export function ContentPageView({ page }: { page: ContentPage }) {
	const crumbs = breadcrumbs(page);
	const isHub = page.kind === "hub";
	const hubItems = isHub ? page.related.map(pageByPath).filter((p): p is ContentPage => !!p) : [];
	return (
		<>
			<JsonLd data={pageJsonLd(page)} />
			<article className="chapter-light bg-bg text-fg">
				<div className="container-text pt-[calc(52px+3rem)] pb-16 md:pt-[calc(52px+5rem)] md:pb-24">
					<nav aria-label="Breadcrumb" className="t-caption text-fg-3">
						<ol className="flex flex-wrap items-center gap-1.5">
							{crumbs.map((c, i) => (
								<li key={c.path} className="flex items-center gap-1.5">
									{i > 0 && <ChevronRight aria-hidden="true" size={13} />}
									{i === crumbs.length - 1 ? (
										<span aria-current="page" className="text-fg-2">
											{c.name}
										</span>
									) : (
										<a href={c.path} className="hover:text-accent">
											{c.name}
										</a>
									)}
								</li>
							))}
						</ol>
					</nav>

					<header className="mt-10">
						<p className="t-caption font-semibold tracking-[0.04em] text-accent uppercase">{page.eyebrow}</p>
						<h1 className="t-display-m mt-3">{page.h1}</h1>
						<p className="t-lead mt-6 text-fg-2">{page.lead}</p>
						{!isHub && (
							<div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
								<EarlyAccessButton size="lg" />
								{page.kind === "download" ? (
									<Button variant="secondary" size="lg" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
										View on GitHub
									</Button>
								) : (
									<Button variant="secondary" size="lg" href="/download">
										How to download
									</Button>
								)}
							</div>
						)}
					</header>

					{!isHub && (
						<div className="mt-12">
							<MacWindow radius={12}>
								<Screenshot
									name={page.image.name}
									alt={page.image.alt}
									theme="light"
									priority
									sizes="(min-width: 800px) 760px, 100vw"
								/>
							</MacWindow>
						</div>
					)}

					{page.blocks.map((b) => (
						<BlockView key={b.h2} block={b} />
					))}

					{isHub && (
						<ul className="mt-12 grid gap-4">
							{hubItems.map((p) => (
								<li key={p.path}>
									<a
										href={p.path}
										className="group flex flex-col rounded-2xl border border-line bg-card p-6 transition-colors duration-200 hover:border-accent"
									>
										<span className="t-title">{p.title}</span>
										<span className="t-body mt-2 text-fg-2">{p.description}</span>
										<span className="t-caption mt-3 inline-flex items-center text-accent">
											Read more <ChevronRight aria-hidden="true" size={15} />
										</span>
									</a>
								</li>
							))}
						</ul>
					)}

					{page.faq && (
						<section className="mt-20" aria-labelledby="faq-title">
							<h2 id="faq-title" className={H2}>
								Frequently asked questions
							</h2>
							<div className="od-faq mt-6 border-t border-line">
								{page.faq.map((item) => (
									<details key={item.q} className="od-faq-item border-b border-line">
										<summary className="od-faq-summary flex cursor-pointer items-center justify-between gap-6 py-5 text-left text-[1.125rem] font-semibold tracking-[-0.01em]">
											<span>{item.q}</span>
											<Plus aria-hidden="true" strokeWidth={1.75} className="od-faq-icon size-6 shrink-0 text-fg-3" />
										</summary>
										<div className="od-faq-body">
											<p className="t-body pb-6 text-fg-2">{item.a}</p>
										</div>
									</details>
								))}
							</div>
						</section>
					)}

					{!isHub && <Related page={page} />}
				</div>
			</article>

			<section className="chapter-dark section-pad bg-bg text-fg">
				<div className="container-text flex flex-col items-center text-center">
					<Mascot pose="envelope" size={140} still />
					<h2 className="t-display-m mt-6">Be first in line.</h2>
					<p className="t-lead mt-4 max-w-[34ch] text-fg-2">
						OpenDot is coming to the Mac. Join the early-access list and we will send you the download as soon as it is
						ready.
					</p>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
						<EarlyAccessButton size="lg" />
						<Button variant="secondary" size="lg" href="/">
							Back to OpenDot
						</Button>
					</div>
				</div>
			</section>
		</>
	);
}
