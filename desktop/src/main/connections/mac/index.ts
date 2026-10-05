import type { ToolDefinition } from "../../runtime/pi-adapter";
import { calendarTools } from "./calendar";
import { clipboardTools } from "./clipboard";
import { contactsTools } from "./contacts";
import type { MacDeps } from "./deps";
import { notesTools } from "./notes";
import { notifyTools } from "./notify";
import { openTools } from "./open";
import { remindersTools } from "./reminders";
import { screenTools } from "./screen";

export type { MacDeps } from "./deps";

export function macTools(features: string[], deps: MacDeps): ToolDefinition[] {
	const on = new Set(features);
	const out: ToolDefinition[] = [];
	if (on.has("calendar")) out.push(...calendarTools(deps));
	if (on.has("reminders")) out.push(...remindersTools(deps));
	if (on.has("contacts")) out.push(...contactsTools(deps));
	if (on.has("notes")) out.push(...notesTools(deps));
	if (on.has("screen")) out.push(...screenTools(deps));
	if (on.has("clipboard")) out.push(...clipboardTools(deps));
	if (on.has("notifications")) out.push(...notifyTools(deps));
	if (on.has("open")) out.push(...openTools(deps));
	return out;
}

/** Spec 05 §6 "Default decision" column. */
export const MAC_DEFAULT_DECISIONS: Record<string, "allow" | "ask" | "deny"> = {
	read: "allow",
	ls: "allow",
	grep: "allow",
	find: "allow",
	write: "ask",
	edit: "ask",
	bash: "ask",
	mac_calendar_events: "allow",
	mac_calendar_create: "ask",
	mac_reminders_list: "allow",
	mac_reminders_add: "ask",
	mac_reminders_complete: "ask",
	mac_contacts_search: "allow",
	mac_notes_search: "allow",
	mac_notes_read: "allow",
	mac_notes_create: "ask",
	mac_screenshot: "ask",
	mac_clipboard_read: "ask",
	mac_clipboard_write: "allow",
	mac_notify: "allow",
	mac_open_url: "ask",
	mac_open_app: "ask",
};
