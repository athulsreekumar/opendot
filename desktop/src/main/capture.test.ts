import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureWindowOptions, fakeScriptsCandidates } from "./capture";

describe("capture flags", () => {
	it("are off by default", () => {
		expect(captureWindowOptions({}, "linux")).toEqual({});
		expect(fakeScriptsCandidates({}, "/app", "/cwd")).toEqual([
			join("/app", "test/fixtures/fake-scripts"),
			join("/cwd", "test/fixtures/fake-scripts"),
		]);
	});

	it("OPENDOT_FAKE_SCRIPTS_DIR is tried first", () => {
		expect(fakeScriptsCandidates({ OPENDOT_FAKE_SCRIPTS_DIR: "/seed/scripts" }, "/app", "/cwd")[0]).toBe(
			"/seed/scripts",
		);
	});

	it("OPENDOT_CAPTURE=1 gives a fixed, frameless 1440x900 window off macOS", () => {
		const o = captureWindowOptions({ OPENDOT_CAPTURE: "1" }, "linux");
		expect(o).toMatchObject({ width: 1440, height: 900, useContentSize: true, resizable: false, frame: false });
	});

	it("keeps the native title bar on macOS", () => {
		const o = captureWindowOptions({ OPENDOT_CAPTURE: "1" }, "darwin");
		expect(o).toMatchObject({ width: 1440, height: 900, resizable: false });
		expect(o).not.toHaveProperty("frame");
	});
});
