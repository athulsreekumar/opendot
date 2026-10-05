// url source (spec 12 §4): detect page changes by hashing the visible text.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

export const urlConfigSchema = z.object({
	url: z.string().refine((u) => {
		try {
			const p = new URL(u);
			return (
				p.protocol === "https:" ||
				(p.protocol === "http:" && (p.hostname === "localhost" || p.hostname === "127.0.0.1"))
			);
		} catch {
			return false;
		}
	}, "Only https URLs (or http://localhost) are allowed"),
});
export type UrlConfig = z.infer<typeof urlConfigSchema>;

const MAX_TEXT = 20_000;
const MAX_DIFF = 1500;

export function htmlToText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]*>/g, "\n")
		.split("\n")
		.map((l) => l.replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.join("\n");
}

function pageTitle(html: string, url: string): string {
	const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	const t = m?.[1]?.replace(/\s+/g, " ").trim();
	if (t) return t;
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

async function load(ctx: SourceCtx<UrlConfig>): Promise<{ html: string; text: string; hash: string }> {
	const res = await ctx.deps.fetch(ctx.config.url, { signal: ctx.signal, headers: { accept: "text/html,*/*" } });
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${ctx.config.url}`);
	const html = await res.text();
	const text = htmlToText(html);
	return { html, text, hash: createHash("sha256").update(text).digest("hex") };
}

function addedLines(oldText: string, newText: string): string {
	const old = new Set(oldText.split("\n"));
	const added = newText.split("\n").filter((l) => !old.has(l));
	if (added.length === 0) return "Content was removed or reordered.";
	const out = added.map((l) => `+ ${l}`).join("\n");
	return out.length > MAX_DIFF ? `${out.slice(0, MAX_DIFF - 1)}…` : out;
}

export const urlSource: WatcherSource<UrlConfig> = {
	type: "url",
	label: "Web page",
	configSchema: urlConfigSchema,
	defaultIntervalSec: 300,
	minIntervalSec: 60,
	async poll(ctx, cursor) {
		const cur = await load(ctx);
		const store = JSON.stringify({ hash: cur.hash, text: cur.text.slice(0, MAX_TEXT) });
		let prev: { hash: string; text: string } | undefined;
		try {
			prev = cursor ? (JSON.parse(cursor) as { hash: string; text: string }) : undefined;
		} catch {
			prev = undefined;
		}
		if (!prev || typeof prev.hash !== "string") return { events: [], cursor: store };
		if (prev.hash === cur.hash) return { events: [], cursor: cursor };
		const at = ctx.deps.now().toISOString();
		const ev: NewEvent = {
			title: `Page changed: ${pageTitle(cur.html, ctx.config.url)}`,
			body: addedLines(prev.text ?? "", cur.text),
			facts: { url: ctx.config.url },
			dedupeKey: `${ctx.config.url}#${cur.hash}`,
			importanceHint: "normal",
			occurredAt: at,
		};
		return { events: [ev], cursor: store };
	},
	async test(ctx) {
		try {
			const cur = await load(ctx);
			return {
				ok: true,
				message: `Fetched ${cur.text.length} characters of text`,
				sample: [
					{
						title: `Page changed: ${pageTitle(cur.html, ctx.config.url)}`,
						body: cur.text.slice(0, 300),
						facts: { url: ctx.config.url },
						dedupeKey: `sample:${cur.hash}`,
						importanceHint: "normal",
						occurredAt: ctx.deps.now().toISOString(),
					},
				],
			};
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
