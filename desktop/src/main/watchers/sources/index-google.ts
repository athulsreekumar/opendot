// Google watcher sources, merged into the registry by sources/index.ts.
import type { WatcherSource } from "../types";
import { gmailSource } from "./gmail";
import { googleCalendarSource } from "./google-calendar";
import { googleDriveSource } from "./google-drive";

export const SOURCES_GOOGLE: WatcherSource<never>[] = [
	gmailSource as unknown as WatcherSource<never>,
	googleCalendarSource as unknown as WatcherSource<never>,
	googleDriveSource as unknown as WatcherSource<never>,
];
