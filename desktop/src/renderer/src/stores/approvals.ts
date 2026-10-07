import type {
	ApprovalDecision,
	ApprovalHistoryItem,
	ApprovalHistoryOutcome,
	ApprovalRequest,
	DotId,
} from "@shared/types";
import { create } from "zustand";
import { api } from "../lib/api";

export interface RespondExtras {
	reason?: string;
	editedArgs?: Record<string, unknown>;
}

interface ApprovalsState {
	pending: ApprovalRequest[];
	history: ApprovalHistoryItem[];
	historyLoaded: boolean;
	load(): Promise<void>;
	loadHistory(q?: { dotId?: DotId; outcome?: ApprovalHistoryOutcome }): Promise<void>;
	add(r: ApprovalRequest): void;
	remove(id: string): void;
	addHistory(item: ApprovalHistoryItem): void;
	respond(id: ApprovalRequest["id"], decision: ApprovalDecision, extras?: RespondExtras): Promise<void>;
	denyAll(dotId: DotId, reason?: string): Promise<number>;
	forDot(dotId: string): ApprovalRequest[];
}

export const useApprovals = create<ApprovalsState>((set, get) => ({
	pending: [],
	history: [],
	historyLoaded: false,
	async load() {
		set({ pending: await api.approvals.pending() });
	},
	async loadHistory(q) {
		const history = await api.approvals.history({ ...q, limit: 200 });
		set({ history, historyLoaded: true });
	},
	add(r) {
		set((s) => ({ pending: [...s.pending.filter((x) => x.id !== r.id), r] }));
	},
	remove(id) {
		set((s) => ({ pending: s.pending.filter((x) => x.id !== id) }));
	},
	addHistory(item) {
		set((s) => ({ history: [item, ...s.history.filter((h) => h.id !== item.id)].slice(0, 500) }));
	},
	async respond(id, decision, extras) {
		get().remove(id);
		await api.approvals.respond({ id, decision, ...extras });
	},
	async denyAll(dotId, reason) {
		set((s) => ({ pending: s.pending.filter((p) => p.dotId !== dotId) }));
		return api.approvals.denyAll(dotId, reason);
	},
	forDot(dotId) {
		return get().pending.filter((p) => p.dotId === dotId);
	},
}));
