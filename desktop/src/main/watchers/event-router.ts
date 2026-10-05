// Batching, budgets and delivery of watcher events (spec 12 §2.2–§2.3).
import { newId } from "../../shared/ids";
import type { AppSettings, Dot, DotEvent, DotEventView, DotId, Watcher } from "../../shared/types";
import type { Store } from "../store/store";
import type { NewEvent } from "./types";
import type { UsageTracker } from "./usage";

export interface EventRouterDeps {
	store: Store;
	usage: UsageTracker;
	settings: () => Promise<AppSettings>;
	getDot: (id: DotId) => Promise<Dot | undefined>;
	isLocalModel: (dot: Dot) => Promise<boolean>;
	deliver: (dot: Dot, content: string, events: DotEventView[]) => Promise<void>;
	emitReceived: (dotId: DotId, events: DotEventView[]) => void;
	onOverBudget: (dot: Dot, waiting: number, reason: string) => void;
	onHealth: (dotId: DotId) => void;
}

interface Pending {
	events: DotEvent[];
	timer?: ReturnType<typeof setTimeout>;
	overBudget?: string;
}

export const view = (e: DotEvent): DotEventView => ({
	id: e.id,
	type: e.type,
	title: e.title,
	facts: e.facts,
	importanceHint: e.importanceHint,
	occurredAt: e.occurredAt,
	status: e.status,
});

const SOURCE_LABEL: Record<string, string> = {
	gmail: "Gmail",
	"outlook-mail": "Outlook",
	"google-calendar": "Calendar",
	"outlook-calendar": "Calendar",
	"mac-calendar": "Calendar",
	"mac-reminders": "Reminders",
	"google-drive": "Drive",
	onedrive: "OneDrive",
	"teams-chat": "Teams",
	folder: "Folder",
	url: "Web page",
	rss: "Feed",
	"local-webhook": "Webhook",
	schedule: "Schedule",
	"mcp-resource": "MCP",
	"mcp-poll": "MCP",
};

export function renderEventsForModel(batch: DotEvent[], header?: string): string {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const now = new Date();
	const stamp = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} ${tz}`;
	const lines = [`[OpenDot · ${batch.length} new event${batch.length === 1 ? "" : "s"} · ${stamp}]`];
	if (header) lines.push(header);
	batch.forEach((e, i) => {
		const t = new Date(e.occurredAt).toTimeString().slice(0, 5);
		const facts = Object.entries(e.facts)
			.filter(([, v]) => v)
			.slice(0, 6)
			.map(([k, v]) => `${k}: ${v}`)
			.join(" · ");
		lines.push(`${i + 1}. ${SOURCE_LABEL[e.type] ?? e.type} · ${e.title} · ${t}${facts ? ` · ${facts}` : ""}`);
		if (i < 25 && e.body.trim()) lines.push(`   ${e.body.trim().slice(0, 1500).replace(/\n/g, "\n   ")}`);
	});
	return lines.join("\n");
}

export class EventRouter {
	private pending = new Map<DotId, Pending>();
	private retryTimer: ReturnType<typeof setInterval> | undefined;

	constructor(private readonly deps: EventRouterDeps) {
		this.retryTimer = setInterval(() => void this.retryOverBudget(), 60_000);
		this.retryTimer.unref?.();
	}

	stop(): void {
		if (this.retryTimer) clearInterval(this.retryTimer);
		for (const p of this.pending.values()) if (p.timer) clearTimeout(p.timer);
	}

	queued(dotId: DotId): number {
		return this.pending.get(dotId)?.events.length ?? 0;
	}

	overBudget(dotId: DotId): string | undefined {
		return this.pending.get(dotId)?.overBudget;
	}

	/** A new event from a watcher. */
	async receive(dot: Dot, watcher: Pick<Watcher, "id" | "type">, ev: NewEvent): Promise<void> {
		const e: DotEvent = {
			...ev,
			title: ev.title.slice(0, 140),
			body: ev.body.slice(0, 4000),
			id: newId("evt"),
			dotId: dot.id,
			watcherId: watcher.id as Watcher["id"],
			type: watcher.type,
			receivedAt: new Date().toISOString(),
			status: "queued",
		};
		await this.deps.store.events(dot.id).append(e);
		this.deps.emitReceived(dot.id, [view(e)]);
		await this.deps.store.audit({
			kind: "event",
			dotId: dot.id,
			summary: `${SOURCE_LABEL[e.type] ?? e.type}: event received`,
			data: { watcher: watcher.id },
		});
		const p = this.pending.get(dot.id) ?? { events: [] };
		p.events.push(e);
		this.pending.set(dot.id, p);
		this.deps.onHealth(dot.id);
		if (e.importanceHint === "high" || dot.alwaysOn.batchWindowSec <= 0 || p.events.length >= 25) {
			await this.flush(dot.id);
		} else if (!p.timer) {
			p.timer = setTimeout(() => void this.flush(dot.id), dot.alwaysOn.batchWindowSec * 1000);
		}
	}

	async flush(dotId: DotId, header?: string): Promise<void> {
		const p = this.pending.get(dotId);
		if (!p?.events.length) return;
		if (p.timer) clearTimeout(p.timer);
		p.timer = undefined;
		const dot = await this.deps.getDot(dotId);
		if (!dot) {
			this.pending.delete(dotId);
			return;
		}
		const reason = await this.budgetBlock(dot);
		if (reason) {
			if (!p.overBudget) this.deps.onOverBudget(dot, p.events.length, reason);
			p.overBudget = reason;
			this.deps.onHealth(dotId);
			return;
		}
		const wasOver = !!p.overBudget;
		p.overBudget = undefined;
		const batch = p.events.splice(0, wasOver ? p.events.length : 25);
		for (const e of batch) e.status = "delivered";
		const content = renderEventsForModel(
			batch,
			header ??
				(wasOver ? `You were paused by a budget limit; here are the ${batch.length} events since then.` : undefined),
		);
		this.deps.usage.recordTurn(dotId);
		await this.deps.store
			.setEventStatus(
				dotId,
				batch.map((e) => e.id),
				"delivered",
			)
			.catch(() => undefined);
		try {
			await this.deps.deliver(dot, content, batch.map(view));
		} catch (e) {
			// Put them back; the supervisor retries.
			for (const ev of batch) ev.status = "queued";
			p.events.unshift(...batch);
			throw e;
		} finally {
			this.deps.onHealth(dotId);
		}
		if (p.events.length) p.timer = setTimeout(() => void this.flush(dotId), 2000);
	}

	private async budgetBlock(dot: Dot): Promise<string | undefined> {
		const s = await this.deps.settings();
		if (s.background.paused) return "All Dots are paused.";
		const turns = this.deps.usage.turnsLastHour(dot.id);
		if (turns >= dot.alwaysOn.budget.maxTurnsPerHour)
			return `Hourly limit reached (${dot.alwaysOn.budget.maxTurnsPerHour} turns/hour)`;
		if (!(await this.deps.isLocalModel(dot))) {
			if (this.deps.usage.costToday(dot.id) >= dot.alwaysOn.budget.maxCostUsdPerDay)
				return `Daily budget reached ($${dot.alwaysOn.budget.maxCostUsdPerDay.toFixed(2)})`;
			if (this.deps.usage.costTodayAll() >= s.background.maxCostUsdPerDay) return "Global daily budget reached";
		}
		return undefined;
	}

	private async retryOverBudget(): Promise<void> {
		for (const [dotId, p] of this.pending) {
			if (p.overBudget && p.events.length) await this.flush(dotId).catch(() => undefined);
		}
	}
}
