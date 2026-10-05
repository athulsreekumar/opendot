// Submits every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver). Run after a production deploy.
// Usage: node scripts/indexnow.mjs [--dry-run]   (SITE_URL overrides the host, default https://opendot.live)
import { readFileSync } from "node:fs";

const site = (process.env.SITE_URL ?? "https://opendot.live").replace(/\/$/, "");
const dryRun = process.argv.includes("--dry-run");
const key = /INDEXNOW_KEY\s*=\s*"([0-9a-f]{32})"/.exec(
	readFileSync(new URL("../lib/site.ts", import.meta.url), "utf8"),
)?.[1];
if (!key) throw new Error("INDEXNOW_KEY not found in lib/site.ts");

const sitemap = await fetch(`${site}/sitemap.xml`);
if (!sitemap.ok) throw new Error(`Could not fetch ${site}/sitemap.xml: ${sitemap.status}`);
const urlList = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (!urlList.length) throw new Error("No URLs found in the sitemap");

const body = { host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList };
console.log(`IndexNow: ${urlList.length} URLs for ${body.host}`);
if (dryRun) {
	console.log(JSON.stringify(body, null, 2));
	process.exit(0);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
	method: "POST",
	headers: { "Content-Type": "application/json; charset=utf-8" },
	body: JSON.stringify(body),
});
console.log(`IndexNow response: ${res.status} ${res.statusText}`);
// 200 = accepted, 202 = accepted, key validation pending.
if (res.status !== 200 && res.status !== 202) {
	console.error(await res.text());
	process.exit(1);
}
