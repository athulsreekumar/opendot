// rss source (spec 12 §4): one event per new item; cursor = JSON array of the last 200 ids.
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";
import { type FeedItem, parseFeed } from "./rss-parse";

export const rssConfigSchema = z.object({
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
export type RssConfig = z.infer<typeof rssConfigSchema>;

const MAX_IDS = 200;

async function load(ctx: SourceCtx<RssConfig>): Promise<FeedItem[]> {
	const res = await ctx.deps.fetch(ctx.config.url, {
		signal: ctx.signal,
		headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching feed`);
	return parseFeed(await res.text());
}

function toEvent(ctx: SourceCtx<RssConfig>, it: FeedItem): NewEvent {
	const pubMs = it.published ? Date.parse(it.published) : Number.NaN;
	return {
		title: it.title || it.link || "New feed item",
		body: it.summary.slice(0, 1000),
		facts: { link: it.link, ...(it.published ? { published: it.published } : {}) },
		dedupeKey: it.id,
		importanceHint: "normal",
		occurredAt: Number.isNaN(pubMs) ? ctx.deps.now().toISOString() : new Date(pubMs).toISOString(),
	};
}

export const rssSource: WatcherSource<RssConfig> = {
	type: "rss",
	label: "RSS / Atom feed",
	configSchema: rssConfigSchema,
	defaultIntervalSec: 300,
	minIntervalSec: 60,
	async poll(ctx, cursor) {
		const items = await load(ctx);
		let seen: string[] | undefined;
		try {
			seen = cursor ? (JSON.parse(cursor) as string[]) : undefined;
		} catch {
			seen = undefined;
		}
		if (!Array.isArray(seen)) {
			return { events: [], cursor: JSON.stringify(items.map((i) => i.id).slice(0, MAX_IDS)) };
		}
		const known = new Set(seen);
		const fresh = items.filter((i) => !known.has(i.id));
		// Feeds are newest-first; emit oldest-first.
		const events = fresh.reverse().map((i) => toEvent(ctx, i));
		const ids = [...fresh.map((i) => i.id).reverse(), ...seen].slice(0, MAX_IDS);
		return { events, cursor: JSON.stringify(ids) };
	},
	async test(ctx) {
		try {
			const items = await load(ctx);
			if (items.length === 0) return { ok: false, message: "No items found; is this an RSS or Atom feed?", sample: [] };
			return {
				ok: true,
				message: `Found ${items.length} items`,
				sample: items.slice(0, 3).map((i) => toEvent(ctx, i)),
			};
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
