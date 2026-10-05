// Routes message_dot / ask_dots between Dots with RBAC, approvals, PII and streaming (spec 07 §4, spec 13 §5).
import { newId } from "../../shared/ids";
import type { AppSettings, Dot, DotId, LinkApproval, LinkExchange } from "../../shared/types";
import { log } from "../log";
import type { PiiService } from "../pii/pii-service";
import type { ApprovalBroker } from "../security/approval-broker";
import type { Store } from "../store/store";
import { decideLink, effectivePairs, type LinkCounters } from "./link-policy";

export interface LinkTarget {
	runLinkTurn(req: {
		from: Dot;
		message: string;
		purpose: string;
		chain: DotId[];
		signal?: AbortSignal;
		onDelta?: (d: string) => void;
	}): Promise<string>;
}

export interface LinkBusDeps {
	store: Store;
	approvals: ApprovalBroker;
	pii: PiiService;
	settings: () => Promise<AppSettings>;
	host: (dotId: DotId) => LinkTarget;
	emitExchange: (x: LinkExchange) => void;
	setTalking: (from: DotId, to?: DotId) => void;
	now?: () => Date;
}

export type SendResult = { ok: true; reply: string; to: Dot } | { ok: false; reason: string; to?: Dot };

export class LinkBus {
	private recent: Array<{ from: DotId; to: DotId; at: number }> = [];
	private loaded = false;
	constructor(private readonly deps: LinkBusDeps) {}

	private now(): Date {
		return this.deps.now?.() ?? new Date();
	}

	private async loadCounters(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		const since = Date.now() - 36 * 3600_000;
		for (const x of await this.deps.store.exchanges()) {
			const at = Date.parse(x.startedAt);
			if (at > since && (x.status === "done" || x.status === "running"))
				this.recent.push({ from: x.from, to: x.to, at });
		}
	}

	private counters(): LinkCounters {
		return {
			pairLastHour: (from, to, now) =>
				this.recent.filter((r) => r.from === from && r.to === to && r.at > now.getTime() - 3600_000).length,
			globalToday: (now) => {
				const day = now.toDateString();
				return this.recent.filter((r) => new Date(r.at).toDateString() === day).length;
			},
		};
	}

	async resolve(ref: string): Promise<Dot | undefined> {
		const dots = await this.deps.store.dots.list();
		const r = ref.trim().replace(/^@/, "");
		return (
			dots.find((d) => d.id === r) ??
			dots.find((d) => d.name.toLowerCase() === r.toLowerCase()) ??
			dots.find((d) => d.name.toLowerCase().startsWith(r.toLowerCase()))
		);
	}

	async decide(from: Dot, to: Dot, chain: DotId[]) {
		await this.loadCounters();
		const settings = await this.deps.settings();
		return decideLink({
			from,
			to,
			now: this.now(),
			rules: await this.deps.store.links.read(),
			counters: this.counters(),
			settings: settings.links,
			chain,
		});
	}

	async reachableFrom(from: Dot): Promise<Array<{ dot: Dot; approval: LinkApproval; purpose: string }>> {
		const dots = (await this.deps.store.dots.list()).filter((d) => !d.archived);
		const rules = await this.deps.store.links.read();
		const pairs = effectivePairs(dots, rules, this.now()).filter((p) => p.from === from.id);
		return pairs
			.map((p) => {
				const dot = dots.find((d) => d.id === p.to)!;
				const rule = rules.find((r) => r.id === p.ruleId);
				return { dot, approval: p.approval, purpose: rule?.purpose ?? "" };
			})
			.filter((x) => !!x.dot);
	}

	async send(
		from: Dot,
		toRef: string,
		message: string,
		chain: DotId[],
		opts: {
			signal?: AbortSignal;
			onDelta?: (to: Dot, delta: string) => void;
			onStatus?: (to: Dot, status: "queued" | "running" | "done" | "error" | "blocked", detail?: string) => void;
		} = {},
	): Promise<SendResult> {
		const to = await this.resolve(toRef);
		if (!to) return { ok: false, reason: `No Dot named "${toRef}". Use list_dots to see who you can message.` };
		const d = await this.decide(from, to, chain);
		if (!d.allowed) {
			await this.deps.store.audit({
				kind: "link-blocked",
				dotId: from.id,
				summary: `${from.name} → ${to.name}: ${d.reason}`,
				data: { to: to.id },
			});
			opts.onStatus?.(to, "blocked", d.reason);
			return { ok: false, reason: d.reason, to };
		}
		const settings = await this.deps.settings();
		const ex: LinkExchange = {
			id: newId("exc"),
			linkId: d.ruleId,
			from: from.id,
			to: to.id,
			chain: [...chain, to.id],
			request: message,
			status: d.approval === "ask" ? "pending-approval" : "running",
			startedAt: this.now().toISOString(),
		};
		const save = async (patch: Partial<LinkExchange>) => {
			Object.assign(ex, patch);
			await this.deps.store.exchangesLog.append({ ...ex });
			this.deps.emitExchange({ ...ex });
		};
		await save({});
		this.deps.setTalking(from.id, to.id);
		try {
			if (d.approval === "ask") {
				opts.onStatus?.(to, "queued", "Waiting for your approval");
				const outcome = await this.deps.approvals.request(
					{
						kind: "link",
						dotId: from.id,
						title: `${from.name} wants to message ${to.name}`,
						detail: message.slice(0, 300),
						linkId: d.ruleId,
						peerDotId: to.id,
					},
					{ signal: opts.signal },
				);
				if (outcome === "deny" || outcome === "expired") {
					await save({ status: "rejected", endedAt: this.now().toISOString() });
					opts.onStatus?.(to, "blocked", "The user didn't allow this message.");
					return { ok: false, reason: "The user didn't allow this message.", to };
				}
				await save({ status: "running" });
			}
			this.recent.push({ from: from.id, to: to.id, at: Date.now() });
			let delivered = message;
			if (!d.sharePii && (await this.deps.pii.shouldRedact(to.id)))
				delivered = (await this.deps.pii.redact(from.id, message)).text;
			opts.onStatus?.(to, "running");
			const timeout = AbortSignal.timeout(settings.links.replyTimeoutSec * 1000);
			const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
			const reply = await this.deps.host(to.id).runLinkTurn({
				from,
				message: delivered,
				purpose: d.purpose ?? "",
				chain: [...chain, to.id],
				signal,
				onDelta: (delta) => opts.onDelta?.(to, delta),
			});
			await save({ status: "done", reply, endedAt: this.now().toISOString() });
			await this.deps.store.audit({
				kind: "link-exchange",
				dotId: from.id,
				summary: `${from.name} → ${to.name}`,
				data: { to: to.id, requestChars: message.length, replyChars: reply.length, rule: d.ruleId ?? null },
			});
			opts.onStatus?.(to, "done");
			return { ok: true, reply, to };
		} catch (e) {
			const timedOut = (e as Error).name === "TimeoutError" || /timeout|aborted/i.test((e as Error).message);
			const reason = timedOut
				? `${to.name} didn't reply in time.`
				: `${to.name} couldn't answer: ${(e as Error).message}`;
			await save({ status: timedOut ? "timeout" : "error", error: reason, endedAt: this.now().toISOString() });
			log.warn("link exchange failed", reason);
			opts.onStatus?.(to, "error", reason);
			return { ok: false, reason, to };
		} finally {
			this.deps.setTalking(from.id, undefined);
		}
	}
}
