// Whether pi's `bash` tool can run here. On Windows it needs Git Bash (Git for Windows) or another bash on PATH.
import { getShellConfig } from "@earendil-works/pi-coding-agent";

let cached: boolean | undefined;

/** Resolved with pi's own lookup so we agree with the tool about what is installed. Cached for the app's lifetime
 * on purpose: installing Git needs an OpenDot restart (the PATH is read at launch). */
export function shellAvailable(platform: string = process.platform): boolean {
	if (platform !== "win32") return true;
	if (cached === undefined) {
		try {
			getShellConfig();
			cached = true;
		} catch {
			cached = false;
		}
	}
	return cached;
}
