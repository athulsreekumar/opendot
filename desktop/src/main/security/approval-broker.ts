// Pending approvals ⇄ renderer (spec 06 §4).
import { newId } from "../../shared/ids";
import type { ApprovalDecision, ApprovalId, ApprovalRequest, ApprovalResponse, DotId } from "../../shared/types";

export type ApprovalOutcome = ApprovalDecision | "expired";

/** The full answer: the outcome plus what the user added (a reason, edited arguments) and who answered. */
export interface ApprovalResolution {
	outcome: ApprovalOutcome;
	reason?: string;
	editedArgs?: Record<string, unknown>;
	by: "you" | "timeout" | "stopped";
}

interface Pending {
	req: ApprovalRequest;
	resolve: (r: ApprovalResolution) => void;
	timer: ReturnType<typeof setTimeout>;
}

export interface ApprovalEmitter {
	requested(r: ApprovalRequest): void;
	resolved(id: ApprovalId, decision: ApprovalOutcome, req: ApprovalRequest, resolution: ApprovalResolution): void;
}

export class ApprovalBroker {
	private readonly pendingMap = new Map<ApprovalId, Pending>();
	private readonly listeners = new Set<(dotId: DotId) => void>();
	constructor(private readonly emit: ApprovalEmitter) {}

	request(
		input: Omit<ApprovalRequest, "id" | "createdAt" | "expiresAt">,
		opts: { signal?: AbortSignal; ttlMs?: number } = {},
	): Promise<ApprovalOutcome> {
		return this.requestDetailed(input, opts).then((r) => r.outcome);
	}

	/** Like request(), but also returns the user's reason or edited arguments. */
	requestDetailed(
		input: Omit<ApprovalRequest, "id" | "createdAt" | "expiresAt">,
		opts: { signal?: AbortSignal; ttlMs?: number } = {},
	): Promise<ApprovalResolution> {
		const ttl = opts.ttlMs ?? 5 * 60_000;
		const now = Date.now();
		const req: ApprovalRequest = {
			...input,
			id: newId("apr"),
			createdAt: new Date(now).toISOString(),
			expiresAt: new Date(now + ttl).toISOString(),
		};
		return new Promise<ApprovalResolution>((resolve) => {
			const finish = (r: ApprovalResolution) => {
				const p = this.pendingMap.get(req.id);
				if (!p) return;
				clearTimeout(p.timer);
				this.pendingMap.delete(req.id);
				this.emit.resolved(req.id, r.outcome, req, r);
				for (const l of this.listeners) l(req.dotId);
				resolve(r);
			};
			const timer = setTimeout(() => finish({ outcome: "expired", by: "timeout" }), ttl);
			this.pendingMap.set(req.id, { req, resolve: finish, timer });
			opts.signal?.addEventListener("abort", () => finish({ outcome: "deny", by: "stopped" }), { once: true });
			this.emit.requested(req);
			for (const l of this.listeners) l(req.dotId);
		});
	}

	respond(res: ApprovalResponse): void {
		const reason = res.reason?.trim().slice(0, 500);
		this.pendingMap.get(res.id)?.resolve({
			outcome: res.decision,
			by: "you",
			...(res.decision === "deny" && reason ? { reason } : {}),
			...(res.decision !== "deny" && res.editedArgs ? { editedArgs: res.editedArgs } : {}),
		});
	}

	/** Deny every pending approval of one Dot (the inbox's "Deny all"). Returns how many were denied. */
	denyAll(dotId: DotId, reason?: string): number {
		const mine = this.pending().filter((r) => r.dotId === dotId);
		for (const r of mine) this.respond({ id: r.id, decision: "deny", reason });
		return mine.length;
	}

	pending(): ApprovalRequest[] {
		return [...this.pendingMap.values()].map((p) => p.req);
	}

	hasPending(dotId: DotId): boolean {
		return this.pending().some((r) => r.dotId === dotId);
	}

	cancelForDot(dotId: DotId): void {
		for (const p of [...this.pendingMap.values()])
			if (p.req.dotId === dotId) p.resolve({ outcome: "deny", by: "stopped" });
	}

	onChange(l: (dotId: DotId) => void): () => void {
		this.listeners.add(l);
		return () => this.listeners.delete(l);
	}
}
