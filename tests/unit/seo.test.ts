import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import * as copy from "@/lib/copy";
import { homeJsonLd, SEO_DESCRIPTION, serializeJsonLd } from "@/lib/seo";
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
		expect(app.operatingSystem).toBe("macOS 14 or later");
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
		expect(urls).toEqual(SITE_PATHS.map((p) => `${SITE_URL}${p === "/" ? "/" : p}`));
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
