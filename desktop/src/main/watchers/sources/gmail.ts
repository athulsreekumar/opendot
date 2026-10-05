// Gmail watcher source (spec 12 §4): historyId cursor.
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

const configSchema = z.object({
	query: z.string().optional(),
	labelIds: z.array(z.string()).optional(),
});
type Config = z.infer<typeof configSchema>;

class HistoryTooOld extends Error {}

async function api<T>(ctx: SourceCtx<Config>, path: string): Promise<T> {
	const token = await ctx.deps.getAccessToken("google");
	const res = await ctx.deps.fetch(`${GMAIL}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: ctx.signal,
	});
	if (res.status === 404) throw new HistoryTooOld();
	if (!res.ok) throw new Error(`Gmail API error ${res.status}`);
	return (await res.json()) as T;
}

interface Meta {
	id: string;
	snippet?: string;
	internalDate?: string;
	payload?: { headers?: Array<{ name: string; value: string }> };
}

const hdr = (m: Meta, n: string) =>
	m.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

async function profileHistoryId(ctx: SourceCtx<Config>): Promise<string> {
	const p = await api<{ historyId: string }>(ctx, "/profile");
	return String(p.historyId);
}

async function fetchMeta(ctx: SourceCtx<Config>, id: string): Promise<Meta> {
	return api<Meta>(
		ctx,
		`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
	);
}

function toEvent(m: Meta): NewEvent {
	const from = hdr(m, "From");
	const subject = hdr(m, "Subject") || "(no subject)";
	const date = m.internalDate ? new Date(Number(m.internalDate)) : new Date(hdr(m, "Date") || Date.now());
	return {
		title: `${from} · ${subject}`,
		body: m.snippet ?? "",
		facts: { from, subject, messageId: m.id },
		dedupeKey: m.id,
		importanceHint: "normal",
		occurredAt: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString(),
	};
}

/** Returns true when the message matches `query`; undefined when the check itself failed. */
async function matchesQuery(ctx: SourceCtx<Config>, m: Meta, query: string): Promise<boolean | undefined> {
	const msgId = hdr(m, "Message-ID");
	if (!msgId) return undefined;
	try {
		const r = await api<{ messages?: Array<{ id: string }> }>(
			ctx,
			`/messages?q=${encodeURIComponent(`${query} rfc822msgid:${msgId.replace(/[<>]/g, "")}`)}&maxResults=1`,
		);
		return (r.messages ?? []).some((x) => x.id === m.id);
	} catch {
		return undefined;
	}
}

async function newMessageIds(
	ctx: SourceCtx<Config>,
	startHistoryId: string,
): Promise<{ ids: string[]; historyId: string }> {
	const labels = ctx.config.labelIds?.length ? ctx.config.labelIds : ["INBOX"];
	const ids: string[] = [];
	let historyId = startHistoryId;
	let page: string | undefined;
	do {
		const q = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", labelId: labels[0] ?? "INBOX" });
		if (page) q.set("pageToken", page);
		const r = await api<{
			history?: Array<{ messagesAdded?: Array<{ message: { id: string; labelIds?: string[] } }> }>;
			nextPageToken?: string;
			historyId?: string;
		}>(ctx, `/history?${q}`);
		for (const h of r.history ?? [])
			for (const a of h.messagesAdded ?? []) {
				const ml = a.message.labelIds;
				if (ml && !labels.every((l) => ml.includes(l))) continue;
				if (!ids.includes(a.message.id)) ids.push(a.message.id);
			}
		if (r.historyId) historyId = String(r.historyId);
		page = r.nextPageToken;
	} while (page);
	return { ids, historyId };
}

export const gmailSource: WatcherSource<Config> = {
	type: "gmail",
	label: "Gmail",
	requires: { connectionType: "google", feature: "gmail" },
	configSchema,
	defaultIntervalSec: 30,
	minIntervalSec: 15,
	async poll(ctx, cursor) {
		if (!cursor) return { events: [], cursor: await profileHistoryId(ctx) };
		let found: { ids: string[]; historyId: string };
		try {
			found = await newMessageIds(ctx, cursor);
		} catch (e) {
			if (e instanceof HistoryTooOld) return { events: [], cursor: await profileHistoryId(ctx) };
			throw e;
		}
		const events: NewEvent[] = [];
		for (const id of found.ids) {
			const m = await fetchMeta(ctx, id);
			if (ctx.config.query) {
				const ok = await matchesQuery(ctx, m, ctx.config.query);
				if (ok === false) continue;
			}
			events.push(toEvent(m));
		}
		return { events, cursor: found.historyId };
	},
	async test(ctx) {
		try {
			const q = new URLSearchParams({ maxResults: "3", labelIds: ctx.config.labelIds?.[0] ?? "INBOX" });
			if (ctx.config.query) q.set("q", ctx.config.query);
			const r = await api<{ messages?: Array<{ id: string }> }>(ctx, `/messages?${q}`);
			const sample = await Promise.all(
				(r.messages ?? []).slice(0, 3).map(async (x) => toEvent(await fetchMeta(ctx, x.id))),
			);
			return { ok: true, message: `Connected. ${sample.length} recent message(s) match.`, sample };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
