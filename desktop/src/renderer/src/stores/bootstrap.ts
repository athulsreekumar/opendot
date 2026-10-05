// Wires main → renderer events into the stores. Called once from App.
import { api } from "../lib/api";
import { useApprovals } from "./approvals";
import { useChat } from "./chat";
import { useDots } from "./dots";
import { useRuntime } from "./runtime";
import { useSettings } from "./settings";

let started = false;

export async function bootstrapStores(): Promise<void> {
	if (started) return;
	started = true;
	api.on("dot:event", (e) => {
		useChat.getState().apply(e);
		if (e.type === "status") useDots.getState().setStatus(e.dotId, e.status);
		if (e.type === "dot-updated") useDots.getState().upsert(e.dot);
	});
	api.on("dots:changed", (dots) => useDots.getState().setAll(dots));
	api.on("approval:requested", (r) => useApprovals.getState().add(r));
	api.on("approval:resolved", (r) => useApprovals.getState().remove(r.id));
	api.on("settings:changed", (s) => useSettings.getState().set(s));
	api.on("runtime:health", (h) => useRuntime.getState().setHealth(h));
	api.on("connections:changed", (c) => useRuntime.getState().setConnections(c));
	api.on("connection:status", (s) => useRuntime.getState().setConnectionStatus(s));
	api.on("link:exchange", (x) => useRuntime.getState().addExchange(x));
	await Promise.all([
		useDots.getState().load(),
		useSettings.getState().load(),
		useApprovals.getState().load(),
		useRuntime.getState().loadHealth(),
		useRuntime.getState().loadConnections(),
	]);
}
