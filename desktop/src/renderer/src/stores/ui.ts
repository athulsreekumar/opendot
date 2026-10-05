import { create } from "zustand";
import { api } from "../lib/api";

interface UiState {
	drawerOpen: boolean;
	listWidth: number;
	newDotOpen: boolean;
	drafts: Record<string, string>;
	focused: boolean;
	setDrawer(open: boolean): void;
	toggleDrawer(): void;
	setListWidth(w: number): void;
	setNewDotOpen(open: boolean): void;
	setDraft(dotId: string, text: string): void;
	setFocused(f: boolean): void;
	hydrate(): Promise<void>;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persist(get: () => UiState) {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		const s = get();
		void api.app
			.setUiState({ drawerOpen: s.drawerOpen, listWidth: s.listWidth, drafts: s.drafts })
			.catch(() => undefined);
	}, 500);
}

export const useUi = create<UiState>((set, get) => ({
	drawerOpen: false,
	listWidth: 360,
	newDotOpen: false,
	drafts: {},
	focused: true,
	setDrawer(open) {
		set({ drawerOpen: open });
		persist(get);
	},
	toggleDrawer() {
		set((s) => ({ drawerOpen: !s.drawerOpen }));
		persist(get);
	},
	setListWidth(w) {
		set({ listWidth: Math.max(300, Math.min(480, w)) });
		persist(get);
	},
	setNewDotOpen(open) {
		set({ newDotOpen: open });
	},
	setDraft(dotId, text) {
		set((s) => ({ drafts: { ...s.drafts, [dotId]: text } }));
		persist(get);
	},
	setFocused(f) {
		set({ focused: f });
	},
	async hydrate() {
		try {
			const s = await api.app.getUiState();
			set({ drawerOpen: s.drawerOpen, listWidth: s.listWidth, drafts: s.drafts ?? {} });
		} catch {
			// first run
		}
	},
}));
