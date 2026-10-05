// macOS permission status + deep links (spec 05 §6.2, §6.3).
import { MAC_CAPABILITIES, type MacCapability, type MacPermissionStatus } from "../../../shared/types";
import { isNotAuthorized } from "./jxa";

export interface MacPermissionProbe {
	mediaStatus(kind: "screen"): string;
	isTrustedAccessibility(): boolean;
	runJxa(script: string, timeoutMs?: number): Promise<string>;
	platform: string;
	/** Optional: trigger the screen-capture prompt (desktopCapturer.getSources once). */
	requestScreen?(): Promise<void>;
}

const PANE = "x-apple.systempreferences:com.apple.preference.security?";
export const SETTINGS_URLS: Partial<Record<MacCapability, string>> = {
	calendar: `${PANE}Privacy_Calendars`,
	reminders: `${PANE}Privacy_Reminders`,
	contacts: `${PANE}Privacy_Contacts`,
	notes: `${PANE}Privacy_Automation`,
	screen: `${PANE}Privacy_ScreenCapture`,
	accessibility: `${PANE}Privacy_Accessibility`,
	files: `${PANE}Privacy_AllFiles`,
};

const PROBES: Partial<Record<MacCapability, string>> = {
	calendar: 'JSON.stringify(Application("Calendar").calendars.length)',
	reminders: 'JSON.stringify(Application("Reminders").lists.length)',
	contacts: 'JSON.stringify(Application("Contacts").people.length)',
	notes: 'JSON.stringify(Application("Notes").accounts.length)',
};

const RESTRICTED_OFF_MAC = new Set<MacCapability>([
	"screen",
	"calendar",
	"reminders",
	"contacts",
	"notes",
	"accessibility",
]);

function entry(capability: MacCapability, status: MacPermissionStatus["status"]): MacPermissionStatus {
	const settingsUrl = SETTINGS_URLS[capability];
	return settingsUrl && status !== "not-required" ? { capability, status, settingsUrl } : { capability, status };
}

function mapMedia(s: string): MacPermissionStatus["status"] {
	if (s === "granted" || s === "denied" || s === "restricted") return s;
	return "not-determined";
}

async function statusFor(cap: MacCapability, probe: MacPermissionProbe): Promise<MacPermissionStatus> {
	if (probe.platform !== "darwin") return entry(cap, RESTRICTED_OFF_MAC.has(cap) ? "restricted" : "not-required");
	if (cap === "screen") return entry(cap, mapMedia(probe.mediaStatus("screen")));
	if (cap === "accessibility") return entry(cap, probe.isTrustedAccessibility() ? "granted" : "denied");
	const script = PROBES[cap];
	if (!script) return entry(cap, "not-required");
	try {
		await probe.runJxa(script, 5000);
		return entry(cap, "granted");
	} catch (err) {
		return entry(cap, isNotAuthorized(err) ? "denied" : "not-determined");
	}
}

export async function getMacPermissions(probe: MacPermissionProbe): Promise<MacPermissionStatus[]> {
	return Promise.all(MAC_CAPABILITIES.map((c) => statusFor(c, probe)));
}

/** Run the probe (which triggers the macOS prompt), then return the resulting status. */
export async function requestMacPermission(
	cap: MacCapability,
	probe: MacPermissionProbe,
): Promise<MacPermissionStatus> {
	if (probe.platform === "darwin" && cap === "screen" && probe.requestScreen) {
		try {
			await probe.requestScreen();
		} catch {
			// status below reflects the outcome
		}
	}
	return statusFor(cap, probe);
}
