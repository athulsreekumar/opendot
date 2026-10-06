import { describe, expect, it } from "vitest";
import { builtinComputerLabel, platformFeatures } from "./platform";

const ALL = [
	"files",
	"shell",
	"calendar",
	"reminders",
	"contacts",
	"notes",
	"screen",
	"clipboard",
	"notifications",
	"open",
];

describe("platformFeatures", () => {
	it("keeps every feature on macOS and Linux", () => {
		expect(platformFeatures(ALL, "darwin")).toEqual(ALL);
		expect(platformFeatures(ALL, "linux")).toEqual(ALL);
	});

	it("drops the macOS-only features on Windows", () => {
		expect(platformFeatures(ALL, "win32")).toEqual(["files", "shell", "screen", "clipboard", "notifications", "open"]);
	});

	it("keeps folder grants and unknown entries on Windows", () => {
		expect(platformFeatures(["files", "folder:C:\\Users\\a"], "win32")).toEqual(["files", "folder:C:\\Users\\a"]);
	});
});

describe("builtinComputerLabel", () => {
	it("says This PC on Windows and This Mac elsewhere", () => {
		expect(builtinComputerLabel("win32")).toBe("This PC");
		expect(builtinComputerLabel("darwin")).toBe("This Mac");
	});
});
