import type { KnowledgeFolderView, KnowledgeState } from "@shared/types";
import { create } from "zustand";
import { api } from "../lib/api";

interface KnowledgeStore {
	folders: KnowledgeFolderView[];
	loaded: boolean;
	load(): Promise<void>;
	set(state: KnowledgeState): void;
}

export const useKnowledge = create<KnowledgeStore>((set) => ({
	folders: [],
	loaded: false,
	async load() {
		set({ ...(await api.knowledge.state()), loaded: true });
	},
	set(state) {
		set({ folders: state.folders, loaded: true });
	},
}));
