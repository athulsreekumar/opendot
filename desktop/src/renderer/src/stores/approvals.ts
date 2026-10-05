import type { ApprovalDecision, ApprovalRequest } from "@shared/types";
import { create } from "zustand";
import { api } from "../lib/api";

interface ApprovalsState {
	pending: ApprovalRequest[];
	load(): Promise<void>;
	add(r: ApprovalRequest): void;
	remove(id: string): void;
	respond(id: ApprovalRequest["id"], decision: ApprovalDecision): Promise<void>;
	forDot(dotId: string): ApprovalRequest[];
}

export const useApprovals = create<ApprovalsState>((set, get) => ({
	pending: [],
	async load() {
		set({ pending: await api.approvals.pending() });
	},
	add(r) {
		set((s) => ({ pending: [...s.pending.filter((x) => x.id !== r.id), r] }));
	},
	remove(id) {
		set((s) => ({ pending: s.pending.filter((x) => x.id !== id) }));
	},
	async respond(id, decision) {
		get().remove(id);
		await api.approvals.respond({ id, decision });
	},
	forDot(dotId) {
		return get().pending.filter((p) => p.dotId === dotId);
	},
}));
