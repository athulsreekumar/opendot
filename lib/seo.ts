import type { Metadata } from "next";
import { faq, GITHUB_URL, hero, meta } from "@/lib/copy";
import type { ContentPage } from "@/lib/pages";
import { SITE_URL } from "@/lib/site";

export const SITE_NAME = "OpenDot";

/** Keyword-rich but natural description, kept under 160 characters. */
export const SEO_DESCRIPTION =
	"OpenDot is a free, open source app that gives you a team of private AI assistants, and lets SuperDot run projects across them. Any model, data stays local.";

export const SEO_KEYWORDS = [
	"AI agent team",
	"multi-agent AI app",
	"AI project manager",
	"AI departments",
	"open source AI agents",
	"AI team for small business",
	"AI assistants for Mac",
	"AI agents Mac app",
	"personal AI team",
	"local AI",
	"private AI assistant",
	"Ollama Mac app",
	"MCP client Mac",
	"Gmail AI assistant",
	"AI email assistant Mac",
	"AI calendar assistant",
	"macOS AI agents",
	"run AI locally on Mac",
	"Claude GPT Gemini Mac app",
	"open source AI assistant",
	"open source AI agents Mac",
	"AI assistant Windows",
	"open source AI agents Windows",
];

export const OG_ALT =
	"OpenDot: your AI team, living on your computer, now with an organisation of Dots run by SuperDot. For Mac and Windows.";

const abs = (path: string) => `${SITE_URL}${path}`;

const SHOTS = [
	{
		name: "org-board",
		alt: "OpenDot Organisation: a project board with a card for each task a department Dot is working on",
	},
	{ name: "sidebar-full", alt: "OpenDot on a Mac: the sidebar with a team of Dots" },
	{ name: "superbot-answer", alt: "SuperDot's combined answer, assembled from every Dot, with sources." },
	{ name: "links-screen", alt: "OpenDot's Dot Links settings showing which Dots may message each other" },
	{ name: "settings-models", alt: "OpenDot model settings with cloud and local model providers" },
	{
		name: "connections",
		alt: "OpenDot connections settings listing Google Workspace, Microsoft 365, Mac and MCP servers",
	},
	{ name: "privacy", alt: "OpenDot privacy settings" },
];

export const FEATURE_LIST = [
	"OpenDot Organisation: a team of Dots, one per department (13 departments, 4 one-click templates), with SuperDot as project manager",
	"SuperDot plans a project into tasks with an owner, dependencies and a reviewer, and you edit and approve the plan before anything runs",
	"Independent tasks run in parallel, Dots can ask you a question, reviewer Dots can request changes, and deliverables and a final report are tracked on a board",
	"28 built-in department playbooks (skills) you can edit, plus your own",
	"Project budgets, pause and cancel, approvals, Dot Links rules and PII masking apply to every task",
	"A team of AI assistants called Dots, each with one job, a personality and scoped access",
	"Dots run 24/7 in the background and react to new email, calendar changes, files and webhooks",
	"SuperDot asks the right Dots and combines their answers with sources",
	"Dot Links control which Dots can message which, with role-based access, schedules, rate limits and approvals",
	"Private by default: data stays in ~/.opendot on your computer and keys are encrypted by the operating system",
	"Emails, phone numbers and card details are masked before reaching cloud models",
	"Actions that change things ask for your approval first",
	"Works with Claude, GPT, Gemini, Grok, Mistral, DeepSeek, OpenRouter and Groq",
	"Runs local models through Ollama, LM Studio, llama.cpp, vLLM or any compatible URL",
	"Connects to Google Workspace, Microsoft 365, Mac Calendar, Reminders, Contacts, Notes and files",
	"Unlimited MCP servers and webhooks",
	"Replies stream from the first token",
	"Open source under the MIT license",
];

/** The schema.org @graph for the home page. FAQ text is taken verbatim from lib/copy.ts. */
export function homeJsonLd() {
	const orgId = abs("/#organization");
	const siteId = abs("/#website");
	const appId = abs("/#software");
	const pageId = abs("/#webpage");
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				"@id": orgId,
				name: SITE_NAME,
				url: abs("/"),
				logo: { "@type": "ImageObject", url: abs("/icon.png"), width: 512, height: 512 },
				sameAs: [GITHUB_URL],
			},
			{
				"@type": "WebSite",
				"@id": siteId,
				name: SITE_NAME,
				url: abs("/"),
				inLanguage: "en",
				publisher: { "@id": orgId },
			},
			{
				"@type": "SoftwareApplication",
				"@id": appId,
				name: SITE_NAME,
				url: abs("/"),
				operatingSystem: "macOS 14 or later, Windows 10 or 11",
				applicationCategory: "ProductivityApplication",
				applicationSubCategory: "AI assistant",
				description: SEO_DESCRIPTION,
				softwareRequirements: "macOS 14 or later (Apple silicon or Intel), or Windows 10 or 11 (x64)",
				featureList: FEATURE_LIST,
				screenshot: SHOTS.map((s) => ({
					"@type": "ImageObject",
					url: abs(`/shots/${s.name}-light@2x.webp`),
					caption: s.alt,
				})),
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
				isAccessibleForFree: true,
				license: "https://opensource.org/license/mit",
				downloadUrl: GITHUB_URL,
				installUrl: abs("/download"),
				author: { "@id": orgId },
				publisher: { "@id": orgId },
			},
			{
				"@type": "WebPage",
				"@id": pageId,
				url: abs("/"),
				name: meta.title,
				description: SEO_DESCRIPTION,
				headline: hero.h1.join(" "),
				inLanguage: "en",
				isPartOf: { "@id": siteId },
				about: { "@id": appId },
				primaryImageOfPage: abs("/opengraph-image"),
			},
			{
				"@type": "FAQPage",
				"@id": abs("/#faq"),
				isPartOf: { "@id": pageId },
				mainEntity: faq.items.map((i) => ({
					"@type": "Question",
					name: i.q,
					acceptedAnswer: { "@type": "Answer", text: i.a },
				})),
			},
		],
	};
}

/** Serialises JSON-LD for a <script> tag, escaping "<" so the payload can never close the tag. */
export function serializeJsonLd(data: unknown) {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}

// ---------------------------------------------------------------------------------------------------------------
// Inner pages (features, guides, download)
// ---------------------------------------------------------------------------------------------------------------

export const pageUrl = (path: string) => abs(path);
export const pageImageUrl = (page: ContentPage) => abs(`/shots/${page.image.name}-light@2x.webp`);

/** Next.js metadata for an inner page. Always sets the canonical, because the root layout's canonical is "/". */
export function pageMetadata(page: ContentPage): Metadata {
	const title = `${page.title} | ${SITE_NAME}`;
	const isGuide = page.kind === "guide";
	return {
		title: page.title,
		description: page.description,
		alternates: { canonical: page.path },
		openGraph: {
			type: isGuide ? "article" : "website",
			url: page.path,
			siteName: SITE_NAME,
			locale: "en_US",
			title,
			description: page.description,
			images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: OG_ALT }],
			...(isGuide && page.published
				? { publishedTime: page.published, modifiedTime: page.modified ?? page.published }
				: {}),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description: page.description,
			images: [{ url: "/twitter-image", width: 1200, height: 630, alt: OG_ALT }],
		},
	};
}

const CRUMB_LABELS: Record<string, string> = { features: "Features", guides: "Guides" };

/** Breadcrumb trail for a page: Home, optional section hub, the page itself. */
export function breadcrumbs(page: ContentPage): { name: string; path: string }[] {
	const trail = [{ name: "Home", path: "/" }];
	const [section] = page.path.split("/").filter(Boolean);
	if (section && CRUMB_LABELS[section] && page.path !== `/${section}`) {
		trail.push({ name: CRUMB_LABELS[section], path: `/${section}` });
	}
	trail.push({ name: page.kind === "hub" ? page.eyebrow : page.title, path: page.path });
	return trail;
}

/** JSON-LD for an inner page: WebPage or Article, BreadcrumbList and (when the page has an FAQ) FAQPage. */
export function pageJsonLd(page: ContentPage) {
	const orgId = abs("/#organization");
	const url = abs(page.path);
	const isGuide = page.kind === "guide";
	const crumbs = breadcrumbs(page);
	const graph: Record<string, unknown>[] = [
		{
			"@type": "Organization",
			"@id": orgId,
			name: SITE_NAME,
			url: abs("/"),
			logo: { "@type": "ImageObject", url: abs("/icon.png"), width: 512, height: 512 },
			sameAs: [GITHUB_URL],
		},
		isGuide
			? {
					"@type": "Article",
					"@id": `${url}#article`,
					headline: page.h1,
					description: page.description,
					image: [pageImageUrl(page)],
					datePublished: page.published,
					dateModified: page.modified ?? page.published,
					author: { "@id": orgId },
					publisher: { "@id": orgId },
					mainEntityOfPage: { "@id": `${url}#webpage` },
					inLanguage: "en",
				}
			: undefined,
		{
			"@type": "WebPage",
			"@id": `${url}#webpage`,
			url,
			name: `${page.title} | ${SITE_NAME}`,
			description: page.description,
			inLanguage: "en",
			isPartOf: { "@id": abs("/#website") },
			primaryImageOfPage: pageImageUrl(page),
			breadcrumb: { "@id": `${url}#breadcrumb` },
			...(page.kind !== "hub" && page.kind !== "guide" ? { about: { "@id": abs("/#software") } } : {}),
		},
		{
			"@type": "BreadcrumbList",
			"@id": `${url}#breadcrumb`,
			itemListElement: crumbs.map((c, i) => ({
				"@type": "ListItem",
				position: i + 1,
				name: c.name,
				item: abs(c.path),
			})),
		},
		page.faq?.length
			? {
					"@type": "FAQPage",
					"@id": `${url}#faq`,
					isPartOf: { "@id": `${url}#webpage` },
					mainEntity: page.faq.map((i) => ({
						"@type": "Question",
						name: i.q,
						acceptedAnswer: { "@type": "Answer", text: i.a },
					})),
				}
			: undefined,
	].filter(Boolean) as Record<string, unknown>[];
	return { "@context": "https://schema.org", "@graph": graph };
}
