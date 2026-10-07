import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import * as copy from "@/lib/copy";
import { CONTENT_PAGES, pageByPath } from "@/lib/pages";
import { FEATURE_LIST, homeJsonLd, pageJsonLd, SEO_KEYWORDS, serializeJsonLd } from "@/lib/seo";
import { SITE_PATHS, SITE_URL } from "@/lib/site";
import { BUILTIN_SKILLS } from "../../desktop/src/main/organisation/builtin-skills";
import { ORG_DOMAINS, ORG_TEMPLATES } from "../../desktop/src/main/organisation/catalog";

const { organisation: org, orgDepartments } = copy;
const FEATURE = "/features/organisation";
const GUIDE = "/guides/run-a-project-with-ai-team";
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const strings = (v: unknown): string[] =>
	typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("Organisation copy", () => {
	it("tells the story in five beats", () => {
		expect(org.beats.map((b) => b.id)).toEqual(["ask", "plan", "split", "review", "done"]);
		expect(org.h2).toEqual(["An organisation.", "Run by Dots."]);
		expect(org.eyebrow).toBe("OpenDot Organisation");
	});

	it("has no em dashes, hype words or claims of replacing people", () => {
		const text = strings(org).join("\n");
		expect(text).not.toContain("—");
		expect(text).not.toMatch(/revolution|game.?chang|magic|supercharge|unleash|cutting.?edge|10x/i);
		expect(text).not.toMatch(/replaces? (your )?(employees|staff|workers|people)/i);
	});

	it("names the same departments, templates and skill count as the app", () => {
		expect(orgDepartments.map((d) => [d.id, d.name, d.emoji, d.job])).toEqual(
			ORG_DOMAINS.map((d) => [d.id, d.name, d.emoji, d.tagline]),
		);
		expect(orgDepartments).toHaveLength(13);
		expect(BUILTIN_SKILLS).toHaveLength(28);
		expect(org.stats).toEqual([
			{ value: "13", label: "departments" },
			{ value: "4", label: "team templates" },
			{ value: "28", label: "built-in playbooks" },
		]);
		const name = (id: string) => orgDepartments.find((d) => d.id === id)?.name ?? id;
		expect(org.wall.templates).toHaveLength(ORG_TEMPLATES.length);
		for (const [i, t] of ORG_TEMPLATES.entries()) {
			const card = org.wall.templates[i];
			expect(card?.count, t.id).toBe(t.domains.length);
			if (t.id !== "full") {
				const expected = t.domains.map((d) => name(d).toLowerCase());
				const shown = (card?.domains ?? "").split(", ").map((x) => x.toLowerCase());
				expect(
					shown.map((x) => x.toLowerCase()),
					t.id,
				).toEqual(expected);
			}
		}
	});

	it("has a sensible example plan", () => {
		const names = new Set([...orgDepartments.map((d) => d.name), "You"]);
		const tasks = org.plan.tasks;
		expect(tasks.length).toBeGreaterThanOrEqual(4);
		expect(tasks.length).toBeLessThanOrEqual(5);
		for (const t of tasks) {
			expect(names.has(t.owner), t.title).toBe(true);
			expect(names.has(t.reviewer), t.title).toBe(true);
			expect(t.reviewer, "a reviewer is never the owner").not.toBe(t.owner);
			for (const dep of t.after) expect(dep, "dependencies point to earlier tasks").toBeLessThan(t.n);
		}
		for (const n of org.split.nodes)
			expect(
				orgDepartments.some((d) => d.name === n),
				n,
			).toBe(true);
	});

	it("keeps the FAQ entries about Organisation", () => {
		const qs = copy.faq.items.map((i) => i.q);
		expect(qs).toContain("What is OpenDot Organisation?");
		expect(qs).toContain("Can SuperDot really manage a project across Dots?");
		expect(qs).toContain("Does it cost extra or send my data anywhere?");
		const manage = copy.faq.items.find((i) => i.q.startsWith("Can SuperDot really"))?.a ?? "";
		expect(manage).toMatch(/edit and approve/);
		expect(manage).toMatch(/Dot Links/);
		expect(manage).toMatch(/depends on the models you choose/);
	});

	it("links the hero pill, nav and footer to the right places", () => {
		expect(copy.hero.announce.href).toBe(`#${org.id}`);
		expect(copy.nav.links[0]).toEqual({ label: "Organisation", href: FEATURE });
		const footerHrefs = copy.footer.columns.flatMap((c) => c.links.map((l) => l.href));
		expect(footerHrefs).toContain(FEATURE);
		expect(footerHrefs).toContain(GUIDE);
		for (const href of [...copy.nav.links.map((l) => l.href), ...footerHrefs]) {
			expect(SITE_PATHS.includes(href), href).toBe(true);
		}
	});
});

describe("Organisation pages", () => {
	const feature = pageByPath(FEATURE);
	const guide = pageByPath(GUIDE);

	it("exist with the right kinds and SEO limits", () => {
		expect(feature?.kind).toBe("feature");
		expect(guide?.kind).toBe("guide");
		for (const p of [feature, guide]) {
			expect(p?.title.length).toBeLessThanOrEqual(50);
			expect(p?.description.length).toBeGreaterThanOrEqual(100);
			expect(p?.description.length).toBeLessThanOrEqual(160);
		}
	});

	it("cover every topic the feature page promises", () => {
		const h2s = (feature?.blocks ?? []).map((b) => b.h2.toLowerCase()).join("\n");
		for (const topic of [
			"what opendot organisation is",
			"step by step",
			"departments",
			"skills",
			"review",
			"privacy",
			"who it is for",
			"github",
		]) {
			expect(h2s, topic).toContain(topic);
		}
		expect(feature?.faq?.length).toBeGreaterThanOrEqual(4);
		expect(feature?.faq?.length).toBeLessThanOrEqual(6);
	});

	it("walk through the real UI steps in the guide", () => {
		const steps = (guide?.blocks ?? []).flatMap((b) => b.steps ?? []);
		expect(steps.length).toBeGreaterThanOrEqual(8);
		const text = steps.map((s) => `${s.title} ${s.body}`).join("\n");
		for (const word of ["Create my team", "Approve and start", "Ask SuperDot to replan", "New project"]) {
			expect(text, word).toContain(word);
		}
	});

	it("use only org shots that have alt text and image files in every variant", () => {
		const shots = [feature, guide].flatMap((p) => [p?.image, ...(p?.blocks ?? []).map((b) => b.shot)]);
		const used = shots.filter((s) => s?.name.startsWith("org-"));
		expect(used.length).toBeGreaterThanOrEqual(6);
		for (const s of used) {
			expect(s?.alt.length, s?.name).toBeGreaterThan(20);
		}
		const all = new Set([...used.map((s) => s?.name), ...Object.keys(org.shots).map((k) => `org-${k}`)]);
		expect([...all].sort()).toEqual(
			["org-board", "org-chat", "org-drawer", "org-plan", "org-setup", "org-skills", "org-summary", "org-team"].sort(),
		);
		for (const name of all) {
			for (const theme of ["light", "dark"]) {
				for (const ext of ["avif", "webp"]) {
					expect(
						existsSync(new URL(`../../public/shots/${name}-${theme}@2x.${ext}`, import.meta.url)),
						`${name} ${theme} ${ext}`,
					).toBe(true);
				}
			}
		}
	});

	it("are in the sitemap, with images, and the hubs link to them", () => {
		const entries = sitemap();
		for (const path of [FEATURE, GUIDE]) {
			expect(SITE_PATHS).toContain(path);
			const e = entries.find((x) => x.url === `${SITE_URL}${path}`);
			expect(e, path).toBeTruthy();
			expect(e?.images?.length).toBeGreaterThan(0);
		}
		expect(pageByPath("/features")?.related).toContain(FEATURE);
		expect(pageByPath("/guides")?.related).toContain(GUIDE);
		expect(CONTENT_PAGES.filter((p) => p.path === FEATURE)).toHaveLength(1);
	});

	it("emit FAQ structured data that matches the page", () => {
		for (const p of [feature, guide]) {
			if (!p) throw new Error("missing page");
			const g = (
				JSON.parse(serializeJsonLd(pageJsonLd(p))) as {
					"@graph": { "@type": string; mainEntity?: { name: string }[] }[];
				}
			)["@graph"];
			const faq = g.find((n) => n["@type"] === "FAQPage");
			expect(faq?.mainEntity?.map((e) => e.name)).toEqual((p.faq ?? []).map((f) => f.q));
		}
	});
});

describe("Organisation in SEO data and public files", () => {
	it("leads the feature list and keywords", () => {
		expect(FEATURE_LIST[0]).toMatch(/OpenDot Organisation/);
		for (const k of [
			"AI agent team",
			"multi-agent AI app",
			"AI project manager",
			"AI departments",
			"open source AI agents",
		]) {
			expect(SEO_KEYWORDS, k).toContain(k);
		}
		const app = (
			JSON.parse(serializeJsonLd(homeJsonLd())) as { "@graph": { "@type": string; screenshot?: { url: string }[] }[] }
		)["@graph"].find((n) => n["@type"] === "SoftwareApplication");
		expect(app?.screenshot?.[0]?.url).toContain("/shots/org-board-light@2x.webp");
	});

	it("is described in llms.txt with both new pages", () => {
		const llms = read("public/llms.txt");
		expect(llms).toContain("OpenDot Organisation");
		expect(llms).toContain(`${SITE_URL}${FEATURE}`);
		expect(llms).toContain(`${SITE_URL}${GUIDE}`);
		expect(llms).toMatch(/13 departments/);
		expect(llms).toMatch(/nothing runs before you do/);
	});

	it("is a headline feature in the README and mentioned in the docs", () => {
		const readme = read("README.md");
		expect(readme).toContain("OpenDot Organisation");
		expect(readme).toContain("public/shots/org-board-light@2x.webp");
		expect(read("docs/WEBSITE.md")).toContain("Organisation");
		expect(read("docs/WEBSITE.md")).toContain(GUIDE);
		expect(read("README.md")).not.toContain("—");
	});
});
