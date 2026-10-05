import type { CreateDotInput, Dot, DotId, DotPatch, DotStatus } from "@shared/types";
import { create } from "zustand";
import { api } from "../lib/api";

interface DotsState {
	dots: Dot[];
	statuses: Record<string, DotStatus>;
	loaded: boolean;
	load(): Promise<void>;
	upsert(d: Dot): void;
	setAll(d: Dot[]): void;
	setStatus(dotId: DotId, s: DotStatus): void;
	create(input: CreateDotInput): Promise<Dot>;
	update(id: DotId, patch: DotPatch): Promise<Dot>;
	remove(id: DotId): Promise<void>;
	duplicate(id: DotId): Promise<Dot>;
	markRead(id: DotId): Promise<void>;
	byId(id?: string): Dot | undefined;
	superDot(): Dot | undefined;
}

/** Super first, then pinned, then most recent activity (spec 10 §3.1). */
export function sortDots(dots: Dot[]): Dot[] {
	return [...dots].sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === "super" ? -1 : 1;
		if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
		return b.lastActivityAt.localeCompare(a.lastActivityAt);
	});
}

export const useDots = create<DotsState>((set, get) => ({
	dots: [],
	statuses: {},
	loaded: false,
	async load() {
		const dots = await api.dots.list();
		set({ dots: sortDots(dots), loaded: true });
	},
	upsert(d) {
		set((s) => ({ dots: sortDots([...s.dots.filter((x) => x.id !== d.id), d]) }));
	},
	setAll(d) {
		set({ dots: sortDots(d), loaded: true });
	},
	setStatus(dotId, st) {
		set((s) => ({ statuses: { ...s.statuses, [dotId]: st } }));
	},
	async create(input) {
		const d = await api.dots.create(input);
		get().upsert(d);
		return d;
	},
	async update(id, patch) {
		const d = await api.dots.update(id, patch);
		get().upsert(d);
		return d;
	},
	async remove(id) {
		await api.dots.remove(id);
		set((s) => ({ dots: s.dots.filter((x) => x.id !== id) }));
	},
	async duplicate(id) {
		const d = await api.dots.duplicate(id);
		get().upsert(d);
		return d;
	},
	async markRead(id) {
		const d = get().byId(id);
		if (d && d.unreadCount > 0) {
			get().upsert({ ...d, unreadCount: 0 });
			await api.dots.markRead(id);
		}
	},
	byId(id) {
		return id ? get().dots.find((d) => d.id === id) : undefined;
	},
	superDot() {
		return get().dots.find((d) => d.kind === "super");
	},
}));
