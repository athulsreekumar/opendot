// Dev-only helpers for the marketing-site capture pipeline. Everything here is off unless the env flags are set.
import { join } from "node:path";

export const CAPTURE_SIZE = { width: 1440, height: 900 } as const;

type Env = Record<string, string | undefined>;

/** Candidate folders for the fake model's scripts, in priority order. OPENDOT_FAKE_SCRIPTS_DIR wins when set. */
export function fakeScriptsCandidates(env: Env, appRoot: string, cwd: string): string[] {
	return [
		...(env.OPENDOT_FAKE_SCRIPTS_DIR ? [env.OPENDOT_FAKE_SCRIPTS_DIR] : []),
		join(appRoot, "test/fixtures/fake-scripts"),
		join(cwd, "test/fixtures/fake-scripts"),
	];
}

export function isCaptureMode(env: Env): boolean {
	return env.OPENDOT_CAPTURE === "1";
}

/**
 * Extra BrowserWindow options for capture mode: a fixed 1440×900 content area that cannot be resized.
 * Off macOS the window is also frameless (no OS title bar); macOS keeps its hidden-inset title bar.
 */
export function captureWindowOptions(env: Env, platform: string): Record<string, unknown> {
	if (!isCaptureMode(env)) return {};
	return {
		width: CAPTURE_SIZE.width,
		height: CAPTURE_SIZE.height,
		x: 0,
		y: 0,
		minWidth: CAPTURE_SIZE.width,
		minHeight: CAPTURE_SIZE.height,
		maxWidth: CAPTURE_SIZE.width,
		maxHeight: CAPTURE_SIZE.height,
		useContentSize: true,
		resizable: false,
		maximizable: false,
		fullscreenable: false,
		center: false,
		...(platform === "darwin" ? {} : { frame: false }),
	};
}
