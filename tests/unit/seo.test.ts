import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import * as copy from "@/lib/copy";
import { CONTENT_PAGES } from "@/lib/pages";
import { homeJsonLd, pageJsonLd, pageMetadata, SEO_DESCRIPTION, serializeJsonLd } from "@/lib/seo";
import { INDEXNOW_KEY, SITE_PATHS, SITE_URL } from "@/lib/site";

type Node = { "@type": string; [k: string]: unknown };
const graph = () => (JSON.parse(serializeJsonLd(homeJsonLd())) as { "@graph": Node[] })["@graph"];
const strings = (v: unknown): string[] =>
	typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("JSON-LD", () => {
	it("serialises to valid JSON and escapes '<'", () => {
		const out = serializeJsonLd({ a: "</script><b>" });
		expect(out).not.toContain("<");
		expect(JSON.parse(out).a).toBe("</script><b>");
		expect(() => JSON.parse(serializeJsonLd(homeJsonLd()))).not.toThrow();
	});

	it("contains every expected type", () => {
		expect(graph().map((n) => n["@type"])).toEqual([
			"Organization",
			"WebSite",
			"SoftwareApplication",
			"WebPage",
			"FAQPage",
		]);
	});

	it("describes the app", () => {
		const app = graph().find((n) => n["@type"] === "SoftwareApplication") as Node;
		expect(app.operatingSystem).toBe("macOS 14 or later, Windows 10 or 11");
		expect(app.applicationCategory).toBe("ProductivityApplication");
		expect(app.isAccessibleForFree).toBe(true);
		expect(app.offers).toMatchObject({ price: "0", priceCurrency: "USD" });
		expect((app.featureList as string[]).length).toBeGreaterThan(5);
	});

	it("FAQPage matches the visible FAQ copy exactly", () => {
		const page = graph().find((n) => n["@type"] === "FAQPage") as Node;
		const entities = page.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
		expect(entities.map((e) => [e.name, e.acceptedAnswer.text])).toEqual(copy.faq.items.map((i) => [i.q, i.a]));
		expect(entities.length).toBeGreaterThanOrEqual(8);
		expect(entities.length).toBeLessThanOrEqual(10);
	});
});

describe("metadata files", () => {
	it("sitemap lists every site path on the production host", () => {
		const urls = sitemap().map((e) => e.url);
		expect(urls).toEqual(SITE_PATHS.map((p) => `${SITE_URL}${p}`));
		expect(sitemap()[0]?.priority).toBe(1);
	});

	it("robots allows crawling, hides api and dev pages, points at the sitemap", () => {
		const r = robots();
		expect(r.rules).toMatchObject({ userAgent: "*", allow: "/", disallow: ["/api/", "/dev-"] });
		expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
		expect(r.host).toBe(SITE_URL);
	});

	it("manifest has name, colours and icons", () => {
		const m = manifest();
		expect(m.name).toBe("OpenDot");
		expect(m.theme_color).toBe("#0e9f8a");
		expect(m.icons?.length).toBeGreaterThan(0);
	});

	it("description fits a search snippet", () => {
		expect(SEO_DESCRIPTION.length).toBeLessThanOrEqual(160);
	});

	it("IndexNow key file exists and matches the exported key", () => {
		expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
		expect(readFileSync(new URL(`../../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8")).toBe(INDEXNOW_KEY);
	});
});

describe("inner pages", () => {
	const wordCount = (p: (typeof CONTENT_PAGES)[number]) =>
		strings([p.h1, p.lead, p.blocks, p.faq]).join(" ").split(/\s+/).length;

	it("every content page is in the sitemap and sitemap has no duplicates", () => {
		const urls = sitemap().map((e) => e.url);
		for (const p of CONTENT_PAGES) expect(urls).toContain(`${SITE_URL}${p.path}`);
		expect(new Set(urls).size).toBe(urls.length);
		expect(
			sitemap()
				.filter((e) => e.url.includes("/features/"))
				.every((e) => (e.images?.length ?? 0) > 0),
		).toBe(true);
	});

	it("has a unique title, description, H1 and canonical on every page", () => {
		const metas = CONTENT_PAGES.map((p) => ({ p, m: pageMetadata(p) }));
		for (const field of ["title", "description"] as const) {
			const vals = metas.map(({ m }) => m[field] as string);
			expect(new Set(vals).size).toBe(vals.length);
		}
		expect(new Set(CONTENT_PAGES.map((p) => p.h1)).size).toBe(CONTENT_PAGES.length);
		for (const { p, m } of metas) {
			expect(m.alternates?.canonical).toBe(p.path);
			expect(p.title.length).toBeLessThanOrEqual(50);
			expect(p.description.length).toBeGreaterThanOrEqual(100);
			expect(p.description.length).toBeLessThanOrEqual(160);
		}
	});

	it("has enough copy on feature and guide pages", () => {
		for (const p of CONTENT_PAGES.filter((x) => x.kind === "feature" || x.kind === "guide")) {
			expect(wordCount(p), p.path).toBeGreaterThanOrEqual(500);
		}
	});

	it("emits valid JSON-LD with breadcrumbs, and Article on guides", () => {
		for (const p of CONTENT_PAGES) {
			const g = (JSON.parse(serializeJsonLd(pageJsonLd(p))) as { "@graph": Node[] })["@graph"];
			const types = g.map((n) => n["@type"]);
			expect(types, p.path).toContain("BreadcrumbList");
			expect(types.includes("Article"), p.path).toBe(p.kind === "guide");
			expect(types.includes("FAQPage"), p.path).toBe(!!p.faq?.length);
			expect(JSON.stringify(g)).not.toMatch(/aggregateRating|"review"/);
			if (p.kind === "guide") {
				const a = g.find((n) => n["@type"] === "Article") as Node;
				for (const k of ["headline", "datePublished", "author", "image"]) expect(a[k], k).toBeTruthy();
			}
		}
	});

	it("only links to pages that exist", () => {
		const paths = new Set(CONTENT_PAGES.map((p) => p.path));
		for (const p of CONTENT_PAGES) for (const r of p.related) expect(paths.has(r) || r === "/privacy", r).toBe(true);
	});

	it("has no em dashes and never says SuperBot in page copy or metadata", () => {
		const all = strings([CONTENT_PAGES, CONTENT_PAGES.map(pageMetadata), CONTENT_PAGES.map(pageJsonLd)]).join("\n");
		expect(all).not.toContain("—");
		expect(all).not.toMatch(/SuperBot/);
	});
});

describe("style rules", () => {
	it("has no em dashes in copy, FAQ or structured data", () => {
		const all = [...strings(copy), ...strings(homeJsonLd()), SEO_DESCRIPTION];
		expect(all.filter((s) => s.includes("—"))).toEqual([]);
	});

	it("has no em dashes in public text files", () => {
		for (const f of ["llms.txt", "humans.txt"]) {
			expect(readFileSync(new URL(`../../public/${f}`, import.meta.url), "utf8")).not.toContain("—");
		}
	});

	it("never says SuperBot in visible copy", () => {
		expect(strings(copy).join(" ")).not.toMatch(/SuperBot/);
	});
});
