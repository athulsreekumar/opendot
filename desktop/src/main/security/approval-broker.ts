// Pending approvals ⇄ renderer (spec 06 §4).
import { newId } from "../../shared/ids";
import type { ApprovalDecision, ApprovalId, ApprovalRequest, ApprovalResponse, DotId } from "../../shared/types";

export type ApprovalOutcome = ApprovalDecision | "expired";

interface Pending {
	req: ApprovalRequest;
	resolve: (o: ApprovalOutcome) => void;
	timer: ReturnType<typeof setTimeout>;
}

export interface ApprovalEmitter {
	requested(r: ApprovalRequest): void;
	resolved(id: ApprovalId, decision: ApprovalOutcome): void;
}

export class ApprovalBroker {
	private readonly pendingMap = new Map<ApprovalId, Pending>();
	private readonly listeners = new Set<(dotId: DotId) => void>();
	constructor(private readonly emit: ApprovalEmitter) {}

	request(
		input: Omit<ApprovalRequest, "id" | "createdAt" | "expiresAt">,
		opts: { signal?: AbortSignal; ttlMs?: number } = {},
	): Promise<ApprovalOutcome> {
		const ttl = opts.ttlMs ?? 5 * 60_000;
		const now = Date.now();
		const req: ApprovalRequest = {
			...input,
			id: newId("apr"),
			createdAt: new Date(now).toISOString(),
			expiresAt: new Date(now + ttl).toISOString(),
		};
		return new Promise<ApprovalOutcome>((resolve) => {
			const finish = (o: ApprovalOutcome) => {
				const p = this.pendingMap.get(req.id);
				if (!p) return;
				clearTimeout(p.timer);
				this.pendingMap.delete(req.id);
				this.emit.resolved(req.id, o);
				for (const l of this.listeners) l(req.dotId);
				resolve(o);
			};
			const timer = setTimeout(() => finish("expired"), ttl);
			this.pendingMap.set(req.id, { req, resolve: finish, timer });
			opts.signal?.addEventListener("abort", () => finish("deny"), { once: true });
			this.emit.requested(req);
			for (const l of this.listeners) l(req.dotId);
		});
	}

	respond(res: ApprovalResponse): void {
		this.pendingMap.get(res.id)?.resolve(res.decision);
	}

	pending(): ApprovalRequest[] {
		return [...this.pendingMap.values()].map((p) => p.req);
	}

	hasPending(dotId: DotId): boolean {
		return this.pending().some((r) => r.dotId === dotId);
	}

	cancelForDot(dotId: DotId): void {
		for (const p of [...this.pendingMap.values()]) if (p.req.dotId === dotId) p.resolve("deny");
	}

	onChange(l: (dotId: DotId) => void): () => void {
		this.listeners.add(l);
		return () => this.listeners.delete(l);
	}
}
