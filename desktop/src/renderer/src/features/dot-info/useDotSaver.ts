import type { Dot, DotId, DotPatch } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/design-system/components";
import { errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";

export type SaveStatus = "idle" | "saving" | "saved";

/**
 * Debounced (400 ms) Dot patching with optimistic store updates and an inline "Saved" status.
 * Persona / grant changes show the "Applies from the next message" toast once saved (spec 10 §4.2).
 */
export function useDotSaver(dotId: DotId) {
	const pending = useRef<DotPatch>({});
	const applies = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const mounted = useRef(true);

	const flush = useCallback(async () => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = undefined;
		const patch = pending.current;
		const notify = applies.current;
		pending.current = {};
		applies.current = false;
		if (Object.keys(patch).length === 0) return;
		if (mounted.current) setStatus("saving");
		try {
			await useDots.getState().update(dotId, patch);
			if (mounted.current) {
				setStatus("saved");
				setTimeout(() => mounted.current && setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
			}
			if (notify) toast({ title: "Applies from the next message", variant: "info" });
		} catch (e) {
			if (mounted.current) setStatus("idle");
			toast({ title: "Couldn't save changes", description: errorText(e), variant: "error" });
			void useDots.getState().load();
		}
	}, [dotId]);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			void flush();
		};
	}, [flush]);

	const save = useCallback(
		(patch: DotPatch, opts?: { applies?: boolean }) => {
			const store = useDots.getState();
			const dot = store.byId(dotId);
			if (dot) {
				const { clearModel, ...rest } = patch;
				const next: Dot = { ...dot, ...rest };
				if (clearModel) next.model = undefined;
				store.upsert(next);
			}
			pending.current = { ...pending.current, ...patch };
			if (opts?.applies) applies.current = true;
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => void flush(), 400);
		},
		[dotId, flush],
	);

	const current = useCallback((): Dot | undefined => useDots.getState().byId(dotId), [dotId]);

	const savePersona = useCallback(
		(partial: Partial<Dot["persona"]>) => {
			const dot = current();
			if (dot) save({ persona: { ...dot.persona, ...partial } }, { applies: true });
		},
		[current, save],
	);

	const saveAlwaysOn = useCallback(
		(partial: Partial<Dot["alwaysOn"]>) => {
			const dot = current();
			if (dot) save({ alwaysOn: { ...dot.alwaysOn, ...partial } });
		},
		[current, save],
	);

	return { save, savePersona, saveAlwaysOn, flush, status, saved: status === "saved" };
}
