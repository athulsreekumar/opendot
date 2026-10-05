// Outlook mail watcher (spec 12 §4): messages delta, deltaLink is the cursor.
import { z } from "zod";
import { type GraphDeps, graphJson, oneLine } from "../../connections/microsoft/client";
import type { NewEvent, SourceCtx, SourceDeps, WatcherSource } from "../types";

interface Msg {
	id: string;
	subject?: string;
	from?: { emailAddress?: { name?: string; address?: string } };
	receivedDateTime?: string;
	bodyPreview?: string;
	isDraft?: boolean;
	"@removed"?: unknown;
}
interface DeltaPage {
	value?: Msg[];
	"@odata.nextLink"?: string;
	"@odata.deltaLink"?: string;
}

const MAX_PAGES = 50;

export function graphDeps(deps: SourceDeps): GraphDeps {
	return { fetch: deps.fetch, getAccessToken: () => deps.getAccessToken("microsoft") };
}

/** Follow nextLinks until a deltaLink. A 410 (stale delta) restarts from `restartUrl`. */
export async function drainDelta<T>(
	g: GraphDeps,
	url: string,
	restartUrl: string,
	headers?: Record<string, string>,
): Promise<{ items: T[]; deltaLink: string | undefined; reset: boolean }> {
	let reset = false;
	let next: string | undefined = url;
	let items: T[] = [];
	let deltaLink: string | undefined;
	for (let page = 0; next && page < MAX_PAGES; page++) {
		let data: { value?: T[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };
		try {
			data = await graphJson(g, next, { headers });
		} catch (e) {
			if (!reset && next === url && /error 410/.test(String(e))) {
				reset = true;
				items = [];
				next = restartUrl;
				continue;
			}
			throw e;
		}
		items.push(...(data.value ?? []));
		deltaLink = data["@odata.deltaLink"] ?? deltaLink;
		next = data["@odata.nextLink"];
	}
	return { items, deltaLink, reset };
}

const configSchema = z.object({ folder: z.string().default("inbox") });
type Config = z.infer<typeof configSchema>;

const SELECT = "subject,from,receivedDateTime,bodyPreview";
const deltaUrl = (folder: string) => `/me/mailFolders/${encodeURIComponent(folder)}/messages/delta?$select=${SELECT}`;

function toEvent(m: Msg): NewEvent {
	const from = m.from?.emailAddress?.name || m.from?.emailAddress?.address || "unknown";
	const subject = m.subject || "(no subject)";
	return {
		title: `${from} · ${oneLine(subject, 100)}`,
		body: m.bodyPreview ?? "",
		facts: { from, subject, messageId: m.id },
		dedupeKey: m.id,
		importanceHint: "normal",
		occurredAt: m.receivedDateTime ?? new Date().toISOString(),
	};
}

export const outlookMailSource: WatcherSource<Config> = {
	type: "outlook-mail",
	label: "Outlook mail",
	requires: { connectionType: "microsoft", feature: "mail" },
	configSchema,
	defaultIntervalSec: 30,
	minIntervalSec: 15,
	async poll(ctx: SourceCtx<Config>, cursor) {
		const g = graphDeps(ctx.deps);
		const start = deltaUrl(ctx.config.folder);
		if (!cursor) {
			const { deltaLink } = await drainDelta<Msg>(g, start, start);
			return { events: [], cursor: deltaLink };
		}
		const { items, deltaLink, reset } = await drainDelta<Msg>(g, cursor, start);
		const events = reset
			? []
			: items.filter((m) => !m["@removed"] && !m.isDraft && m.subject !== undefined).map(toEvent);
		return { events, cursor: deltaLink ?? cursor };
	},
	async test(ctx) {
		try {
			const data = await graphJson<DeltaPage>(
				graphDeps(ctx.deps),
				`/me/mailFolders/${encodeURIComponent(ctx.config.folder)}/messages?$top=3&$orderby=receivedDateTime desc&$select=${SELECT}`,
			);
			const sample = (data.value ?? []).slice(0, 3).map(toEvent);
			return { ok: true, message: `Connected. ${sample.length} recent message(s) found.`, sample };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
