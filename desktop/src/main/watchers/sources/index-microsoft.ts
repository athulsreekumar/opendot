// Microsoft watcher sources, merged into the registry by sources/index.ts.
import type { WatcherSource } from "../types";
import { onedriveSource } from "./onedrive";
import { outlookCalendarSource } from "./outlook-calendar";
import { outlookMailSource } from "./outlook-mail";
import { teamsChatSource } from "./teams-chat";

export const SOURCES_MICROSOFT: WatcherSource<never>[] = [
	outlookMailSource as unknown as WatcherSource<never>,
	outlookCalendarSource as unknown as WatcherSource<never>,
	onedriveSource as unknown as WatcherSource<never>,
	teamsChatSource as unknown as WatcherSource<never>,
];
