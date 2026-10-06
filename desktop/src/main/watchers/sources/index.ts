import type { WatcherType } from "../../../shared/types";
import type { WatcherSource } from "../types";
import { SOURCES_A } from "./index-a";
import { SOURCES_GOOGLE } from "./index-google";
import { SOURCES_MAC } from "./index-mac";
import { SOURCES_MICROSOFT } from "./index-microsoft";
import { mcpPollSource, mcpResourceSource } from "./mcp";

type AnySource = WatcherSource<Record<string, unknown>>;

export const SOURCES: AnySource[] = [
	...(SOURCES_A as unknown as AnySource[]),
	...(SOURCES_GOOGLE as unknown as AnySource[]),
	...(SOURCES_MICROSOFT as unknown as AnySource[]),
	// Calendar and Reminders sources use macOS scripting, so they only exist there.
	...(process.platform === "win32" ? [] : (SOURCES_MAC as unknown as AnySource[])),
	mcpResourceSource as unknown as AnySource,
	mcpPollSource as unknown as AnySource,
];

export function sourceFor(type: WatcherType): AnySource | undefined {
	return SOURCES.find((s) => s.type === type);
}

export const PUSH_TYPES: WatcherType[] = ["folder", "local-webhook", "mcp-resource"];
