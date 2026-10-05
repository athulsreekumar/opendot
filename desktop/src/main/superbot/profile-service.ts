// SuperBot directory, knowledge summaries, instant updates and history search (spec 13 §2–§4).
import type { Dot, DotId } from "../../shared/types";
import type { LinkBus } from "../links/link-bus";
import { log } from "../log";
import type { ModelService } from "../models/model-service";
import type { PiiService } from "../pii/pii-service";
import type { DotRuntime } from "../runtime/dot-runtime";
import { SessionManager } from "../runtime/pi-adapter";
import { blocksText, type EntryLike } from "../runtime/views";
import type { Store } from "../store/store";
import { rank } from "./bm25";

export function card(d: Dot, local: boolean): string {
	const lines = [
		`### ${d.name} — "${d.tagline || d.persona.role.split(/(?<=\.)\s/)[0]}"`,
		`Does: ${d.profile.capabilities.join("; ") || d.persona.role.split(/(?<=\.)\s/)[0] || "general help"}`,
	];
	if (d.profile.dataSources.length)
		lines.push(`Watches: ${d.profile.dataSources.join(" · ")}${d.alwaysOn.enabled ? " · always on" : ""}`);
	if (d.profile.knowledgeSummary) lines.push(`Knows now: ${d.profile.knowledgeSummary}`);
	lines.push(`Roles: ${d.roles.join(", ") || "—"}${local ? " · Model: local 🔒" : ""}`);
	return lines.join("\n").slice(0, 700);
}

export async function buildDirectory(store: Store, bus: LinkBus, superDot: Dot, query: string): Promise<string> {
	const reachable = await bus.reachableFrom(superDot);
	const dots = reachable.map((r) => r.dot).filter((d) => d.kind === "standard" && !d.hiddenFromSuper);
	if (!dots.length)
		return "You have no Dots you can ask yet. Suggest the user creates one (the + button) or allows SuperDot in Dot Links.";
	dots.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
	const cards = dots.map((d) => ({ item: d, text: card(d, false) }));
	const total = cards.reduce((s, c) => s + c.text.length, 0);
	let chosen = cards;
	let rest: Dot[] = [];
	if (total > 6000) {
		const ranked = rank(cards, query).map((r) => r.item);
		const top = new Set(ranked.slice(0, 12).map((d) => d.id));
		chosen = cards.filter((c) => top.has(c.item.id));
		rest = dots.filter((d) => !top.has(d.id));
	}
	void store;
	return [
		"These are the user's Dots you can ask with ask_dots (use the exact names):",
		...chosen.map((c) => c.text),
		rest.length ? `Also available: ${rest.map((d) => d.name).join(", ")}` : "",
	]
		.filter(Boolean)
		.join("\n\n");
}

export class ProfileService {
	private counts = new Map<DotId, number>();
	private queue: DotId[] = [];
	private running = false;
	private timer: ReturnType<typeof setInterval> | undefined;
	private runtime: DotRuntime | undefined;

	constructor(
		private readonly store: Store,
		private readonly models: ModelService,
		private readonly pii: PiiService,
	) {}

	start(runtime: DotRuntime): void {
		this.runtime = runtime;
		this.timer = setInterval(() => void this.sixHourly(), 15 * 60_000);
		this.timer.unref?.();
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
	}

	noteActivity(dotId: DotId): void {
		const n = (this.counts.get(dotId) ?? 0) + 1;
		this.counts.set(dotId, n);
		if (n >= 10) this.enqueue(dotId);
	}

	async refreshAll(): Promise<void> {
		for (const d of await this.store.dots.list()) if (d.kind === "standard" && !d.archived) this.enqueue(d.id);
		await this.drain();
	}

	private async sixHourly(): Promise<void> {
		for (const d of await this.store.dots.list()) {
			if (d.kind !== "standard") continue;
			const age = Date.now() - Date.parse(d.profile.updatedAt);
			if (age > 6 * 3600_000 && (this.counts.get(d.id) ?? 0) > 0) this.enqueue(d.id);
		}
	}

	private enqueue(id: DotId): void {
		if (!this.queue.includes(id)) this.queue.push(id);
		void this.drain();
	}

	private async drain(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			while (this.queue.length) {
				const id = this.queue.shift()!;
				await this.summarize(id).catch((e) => log.warn("knowledge summary failed", (e as Error).message));
			}
		} finally {
			this.running = false;
		}
	}

	private recentText(dot: Dot, max = 40): string[] {
		try {
			const sm = SessionManager.continueRecent(dot.workspaceDir, this.store.paths.dotSessions(dot.id));
			const entries = sm.getBranch() as unknown as EntryLike[];
			return entries
				.filter((e) => e.type === "message" && (e.message?.role === "user" || e.message?.role === "assistant"))
				.slice(-max)
				.map(
					(e) => `${e.message!.role === "user" ? "User" : dot.name}: ${blocksText(e.message!.content).slice(0, 600)}`,
				)
				.filter((l) => l.length > 8);
		} catch {
			return [];
		}
	}

	private async summarize(id: DotId): Promise<void> {
		const dot = await this.store.dots.get(id);
		if (!dot) return;
		const lines = this.recentText(dot);
		if (!lines.length) return;
		let model: Awaited<ReturnType<ModelService["resolveModel"]>>;
		try {
			model = await this.models.resolveModel(dot.model);
		} catch {
			return;
		}
		let transcript = lines.join("\n");
		if (await this.pii.shouldRedact(id)) transcript = (await this.pii.redact(id, transcript)).text;
		const res = await this.models.runtime.completeSimple(
			model,
			{
				systemPrompt: `You maintain a short status note for an assistant named ${dot.name}. Role: ${dot.persona.role.slice(0, 300)}`,
				messages: [
					{
						role: "user",
						content: `Previous note: ${dot.profile.knowledgeSummary || "(none)"}\n\nRecent conversation:\n${transcript}\n\nIn ≤ 120 words, state what ${dot.name} is currently tracking or knows that the user might ask about. Facts only, newest first. No greetings.`,
						timestamp: Date.now(),
					},
				],
			},
			{ maxTokens: 220, signal: AbortSignal.timeout(60000) } as never,
		);
		const text = this.pii.restore(id, blocksText(res.content)).trim().slice(0, 900);
		if (!text || res.stopReason === "error") return;
		this.counts.set(id, 0);
		await this.store.dots.update(id, (d) => ({
			...d,
			profile: { ...d.profile, knowledgeSummary: text, updatedAt: new Date().toISOString() },
		}));
		void this.runtime;
	}

	async updates(bus: LinkBus, ref: string | undefined, sinceMs: number, limit: number): Promise<string> {
		const all = await this.store.dots.list();
		const superDot = all.find((d) => d.kind === "super");
		let targets = all.filter((d) => d.kind === "standard" && !d.archived && !d.hiddenFromSuper);
		if (ref) {
			const d = await bus.resolve(ref);
			if (!d) return `No Dot named "${ref}".`;
			targets = [d];
		}
		const out: string[] = [];
		for (const d of targets) {
			if (superDot && !(await bus.decide(superDot, d, [superDot.id])).allowed) continue;
			const events = (await this.store.latestEvents(d.id))
				.filter((e) => Date.parse(e.receivedAt) >= sinceMs)
				.slice(-limit);
			const updates = this.recentText(d, 60)
				.filter((l) => l.startsWith(`${d.name}:`))
				.slice(-5);
			if (!events.length && !updates.length && !d.profile.knowledgeSummary) continue;
			const lines = [`## ${d.name}`];
			if (d.profile.knowledgeSummary) lines.push(`Status: ${d.profile.knowledgeSummary}`);
			for (const e of events) lines.push(`- ${new Date(e.receivedAt).toLocaleString()} · ${e.title} (${e.status})`);
			for (const u of updates) lines.push(`- latest reply: ${u.slice(d.name.length + 2, d.name.length + 300)}`);
			out.push(lines.join("\n"));
		}
		return out.join("\n\n") || "No new updates from your Dots in that period.";
	}

	async searchHistory(bus: LinkBus, ref: string, query: string, limit: number): Promise<string> {
		const d = await bus.resolve(ref);
		if (!d) return `No Dot named "${ref}".`;
		if (d.hiddenFromSuper) return `${d.name} is hidden from SuperDot.`;
		const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
		const sm = SessionManager.continueRecent(d.workspaceDir, this.store.paths.dotSessions(d.id));
		const hits: string[] = [];
		for (const e of (sm.getBranch() as unknown as EntryLike[]).reverse()) {
			if (e.type !== "message" || !e.message) continue;
			const text = this.pii.restore(d.id, blocksText(e.message.content));
			const low = text.toLowerCase();
			if (!terms.every((t) => low.includes(t))) continue;
			const i = low.indexOf(terms[0] ?? "");
			hits.push(`- ${e.timestamp} (${e.message.role}): …${text.slice(Math.max(0, i - 200), i + 200)}…`);
			if (hits.length >= limit) break;
		}
		return hits.join("\n") || "No matches.";
	}
}
