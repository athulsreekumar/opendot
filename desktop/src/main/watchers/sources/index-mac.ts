import type { WatcherSource } from "../types";
import { macCalendarSource } from "./mac-calendar";
import { macRemindersSource } from "./mac-reminders";

export const SOURCES_MAC: WatcherSource<never>[] = [
	macCalendarSource,
	macRemindersSource,
] as unknown as WatcherSource<never>[];
