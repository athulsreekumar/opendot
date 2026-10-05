// mac-reminders watcher (spec 12 §4): reminders due <= now and not completed; dedupe per (id, dueDate).
import { z } from "zod";
import { isNotAuthorized, jsString } from "../../connections/mac/jxa";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";
import { NeedsAuthError } from "../types";

type Config = { list?: string };
interface Rem {
	id: string;
	title: string;
	due: string;
	list: string;
}

function script(nowIso: string, list: string | undefined): string {
	return `(function(){
const app = Application("Reminders");
const now = new Date(${jsString(nowIso)});
const only = ${jsString(list ?? null)};
const lists = only === null ? app.lists() : [app.lists.byName(only)];
const out = [];
for (const l of lists) {
  for (const r of l.reminders.whose({completed:false})()) {
    const d = r.dueDate();
    if (d && d <= now) out.push({id:r.id(), title:r.name(), due:d.toISOString(), list:l.name()});
  }
}
return JSON.stringify(out);
})()`;
}

async function fetchDue(ctx: SourceCtx<Config>): Promise<Rem[]> {
	try {
		const out = await ctx.deps.runJxa(script(ctx.deps.now().toISOString(), ctx.config.list), 15000);
		return JSON.parse(out) as Rem[];
	} catch (err) {
		if (isNotAuthorized(err)) throw new NeedsAuthError("Allow OpenDot to control Reminders in System Settings");
		throw err;
	}
}

function toEvent(r: Rem, now: Date): NewEvent {
	return {
		title: `Reminder due: ${r.title}`,
		body: `${r.title} (list: ${r.list}), due ${r.due}`,
		facts: { title: r.title, due: r.due, list: r.list },
		dedupeKey: `mac-reminders:${r.id}:${r.due}`,
		importanceHint: "normal",
		occurredAt: now.toISOString(),
	};
}

function parseCursor(c: string | undefined): string[] {
	if (!c) return [];
	try {
		const v = JSON.parse(c) as { seen?: string[] };
		return Array.isArray(v.seen) ? v.seen : [];
	} catch {
		return [];
	}
}

export const macRemindersSource: WatcherSource<Config> = {
	type: "mac-reminders",
	label: "Reminders (this Mac)",
	requires: { connectionType: "mac", feature: "reminders" },
	configSchema: z.object({ list: z.string().optional() }) as unknown as z.ZodType<Config>,
	defaultIntervalSec: 60,
	minIntervalSec: 60,
	async poll(ctx, cursor) {
		const now = ctx.deps.now();
		const due = await fetchDue(ctx);
		const seen = new Set(parseCursor(cursor));
		const out: NewEvent[] = [];
		for (const r of due) {
			const key = `${r.id}:${r.due}`;
			if (seen.has(key)) continue;
			seen.add(key);
			if (cursor !== undefined) out.push(toEvent(r, now));
		}
		// prune completed / no-longer-due entries
		const live = new Set(due.map((r) => `${r.id}:${r.due}`));
		return { events: out, cursor: JSON.stringify({ seen: [...seen].filter((k) => live.has(k)) }) };
	},
	async test(ctx) {
		try {
			const due = await fetchDue(ctx);
			const now = ctx.deps.now();
			return {
				ok: true,
				message: `${due.length} reminder(s) currently due`,
				sample: due.slice(0, 3).map((r) => toEvent(r, now)),
			};
		} catch (err) {
			return { ok: false, message: err instanceof Error ? err.message : String(err), sample: [] };
		}
	},
};
