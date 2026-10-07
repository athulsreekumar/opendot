// Daily briefing (docs/spec/13-superbot.md §6): schedules, catch-up after sleep, and the run itself.
// The run reuses SuperDot's own turn: it fans out with ask_dots and streams one synthesised message.

import { resolveBriefing } from "../../shared/defaults";
import type { AppSettings, BriefingStatus, Connection, Dot } from "../../shared/types";
import { log } from "../log";
import type { JsonFile } from "../store/json-file";
import { briefingCandidates, briefingPrompt, budgetNote, NO_DOTS_NOTE } from "./prompt";
import { briefingLabel, dateKey, decide, nextRun } from "./schedule";

export interface BriefingState {
	/** Local date (YYYY-MM-DD) of the last briefing, manual or scheduled. */
	lastRunDate?: string;
}

export interface BriefingDeps {
	settings: () => Promise<AppSettings>;
	state: JsonFile<BriefingState>;
	listDots: () => Promise<Dot[]>;
	connections: () => Promise<Connection[]>;
	superDot: () => Promise<Dot>;
	/** A plain-language reason when no more model spend is allowed today. */
	budgetBlock: (superDot: Dot) => Promise<string | undefined>;
	/** Start SuperDot's turn. Resolves when the turn is under way, not when it ends. */
	start: (superDot: Dot, req: { prompt: string; date: string; label: string }) => Promise<void>;
	/** Post a short note into SuperDot's chat without a model call. */
	note: (superDot: Dot, req: { text: string; date: string; label: string }) => Promise<void>;
	now?: () => Date;
	tickMs?: number;
}

export type RunResult = { started: boolean; reason?: string };

export class BriefingService {
	private timer: ReturnType<typeof setInterval> | undefined;
	private starting: Promise<RunResult> | undefined;

	constructor(private readonly deps: BriefingDeps) {}

	private now(): Date {
		return this.deps.now?.() ?? new Date();
	}

	start(): void {
		this.stop();
		this.timer = setInterval(() => void this.tick(), this.deps.tickMs ?? 30_000);
		this.timer.unref?.();
		// Catch up shortly after launch, once the app has settled.
		setTimeout(() => void this.tick(), 5000).unref?.();
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	/** One scheduler pass. Safe to call often; a day's briefing is recorded before it starts, so it never repeats. */
	async tick(): Promise<void> {
		try {
			const cfg = resolveBriefing(await this.deps.settings());
			const { lastRunDate } = await this.deps.state.read();
			const d = decide(this.now(), cfg, lastRunDate);
			if (d.kind !== "run") return;
			const r = await this.run({ manual: false });
			if (r.started) log.info(`briefing started${d.catchUp ? " (catch-up)" : ""}`);
		} catch (e) {
			log.warn("briefing tick failed", e);
		}
	}

	async run(opts: { manual: boolean }): Promise<RunResult> {
		if (this.starting) return this.starting;
		this.starting = this.runOnce(opts).finally(() => {
			this.starting = undefined;
		});
		return this.starting;
	}

	private async runOnce(opts: { manual: boolean }): Promise<RunResult> {
		const now = this.now();
		const today = dateKey(now);
		const state = await this.deps.state.read();
		if (!opts.manual && state.lastRunDate === today) return { started: false, reason: "Already ran today." };
		// Record first: a crash or a failure mid-run must not make it run again the same day.
		await this.deps.state.update((s) => ({ ...s, lastRunDate: today }));
		const cfg = resolveBriefing(await this.deps.settings());
		const sup = await this.deps.superDot();
		const meta = { date: today, label: briefingLabel(now) };
		try {
			const blocked = await this.deps.budgetBlock(sup);
			if (blocked) {
				await this.deps.note(sup, { text: budgetNote(blocked), ...meta });
				return { started: false, reason: blocked };
			}
			const candidates = briefingCandidates(await this.deps.listDots(), await this.deps.connections(), cfg.dots);
			const chosen = candidates.filter((c) => c.included);
			if (chosen.length === 0) {
				await this.deps.note(sup, { text: NO_DOTS_NOTE, ...meta });
				return { started: false, reason: "No Dots to ask." };
			}
			const prompt = briefingPrompt({
				dateText: meta.label.replace("Briefing · ", ""),
				dotNames: chosen.map((c) => c.name),
				instructions: cfg.instructions,
			});
			await this.deps.start(sup, { prompt, ...meta });
			return { started: true };
		} catch (e) {
			log.warn("briefing failed to start", e);
			return { started: false, reason: e instanceof Error ? e.message : String(e) };
		}
	}

	async status(): Promise<BriefingStatus> {
		const cfg = resolveBriefing(await this.deps.settings());
		const { lastRunDate } = await this.deps.state.read();
		const next = nextRun(this.now(), cfg, lastRunDate);
		return {
			lastRunDate,
			nextRunAt: next?.toISOString(),
			running: !!this.starting,
			candidates: briefingCandidates(await this.deps.listDots(), await this.deps.connections(), cfg.dots),
		};
	}
}
