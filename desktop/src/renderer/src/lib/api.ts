import type { OpenDotApi, OpenDotTestApi } from "@shared/ipc";

declare global {
	interface Window {
		opendot: OpenDotApi;
		opendotTest?: OpenDotTestApi;
	}
}

export const api: OpenDotApi = window.opendot;

export function errorText(e: unknown): string {
	if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
	return String(e);
}
