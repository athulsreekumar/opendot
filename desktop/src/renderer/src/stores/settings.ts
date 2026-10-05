import type { AppSettings, ModelOption, ProviderSettings } from "@shared/types";
import { create } from "zustand";
import { api } from "../lib/api";

interface SettingsState {
	settings?: AppSettings;
	providers: ProviderSettings[];
	models: ModelOption[];
	load(): Promise<void>;
	set(s: AppSettings): void;
	update(patch: Partial<Omit<AppSettings, "version" | "providers" | "telemetry">>): Promise<AppSettings>;
	refreshModels(): Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
	providers: [],
	models: [],
	async load() {
		const [settings, providers, models] = await Promise.all([
			api.settings.get(),
			api.models.listProviders(),
			api.models.listModels(),
		]);
		set({ settings, providers, models });
	},
	set(s) {
		set({ settings: s });
		void get().refreshModels();
	},
	async update(patch) {
		const s = await api.settings.update(patch);
		set({ settings: s });
		return s;
	},
	async refreshModels() {
		const [providers, models] = await Promise.all([api.models.listProviders(), api.models.listModels()]);
		set({ providers, models });
	},
}));
