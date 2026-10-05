import type { Connection, ConnectionStatus, DotHealth, LinkExchange } from "@shared/types";
import { create } from "zustand";
import { api } from "../lib/api";

interface RuntimeState {
	health: Record<string, DotHealth>;
	connections: Connection[];
	connectionStatus: Record<string, ConnectionStatus>;
	exchanges: LinkExchange[];
	loadHealth(): Promise<void>;
	setHealth(h: DotHealth): void;
	loadConnections(): Promise<void>;
	setConnections(c: Connection[]): void;
	setConnectionStatus(s: ConnectionStatus): void;
	addExchange(x: LinkExchange): void;
}

export const useRuntime = create<RuntimeState>((set) => ({
	health: {},
	connections: [],
	connectionStatus: {},
	exchanges: [],
	async loadHealth() {
		const list = await api.runtime.health();
		set({ health: Object.fromEntries(list.map((h) => [h.dotId, h])) });
	},
	setHealth(h) {
		set((s) => ({ health: { ...s.health, [h.dotId]: h } }));
	},
	async loadConnections() {
		const [connections, statuses] = await Promise.all([api.connections.list(), api.connections.status()]);
		set({ connections, connectionStatus: Object.fromEntries(statuses.map((st) => [st.connectionId, st])) });
	},
	setConnections(c) {
		set({ connections: c });
	},
	setConnectionStatus(st) {
		set((s) => ({ connectionStatus: { ...s.connectionStatus, [st.connectionId]: st } }));
	},
	addExchange(x) {
		set((s) => ({ exchanges: [...s.exchanges.filter((e) => e.id !== x.id), x].slice(-300) }));
	},
}));
