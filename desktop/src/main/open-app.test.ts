import { describe, expect, it, vi } from "vitest";
import { openAppByName, openAppCommand } from "./open-app";

describe("openAppCommand", () => {
	it("uses open -a on macOS", () => {
		expect(openAppCommand("Safari", "darwin")).toEqual({ file: "open", args: ["-a", "Safari"] });
	});

	it("uses cmd start with an empty title on Windows, without a shell string", () => {
		expect(openAppCommand("Visual Studio Code", "win32")).toEqual({
			file: "cmd.exe",
			args: ["/d", "/s", "/c", "start", "", "Visual Studio Code"],
		});
	});

	it("uses xdg-open elsewhere", () => {
		expect(openAppCommand("firefox", "linux")).toEqual({ file: "xdg-open", args: ["firefox"] });
	});

	it.each(["", "   ", "-a evil", "a\nb"])("rejects %j on every platform", (name) => {
		for (const p of ["darwin", "win32", "linux"]) expect(() => openAppCommand(name, p)).toThrow("Invalid app name");
	});

	it.each(["calc & del *", "a|b", "a>b", "%PATH%", 'say "hi"', "C:\\Windows\\evil.exe", "a^b", "../x"])(
		"rejects cmd metacharacters and paths on Windows: %j",
		(name) => {
			expect(() => openAppCommand(name, "win32")).toThrow("Invalid app name");
		},
	);

	it("accepts ordinary Windows app names", () => {
		for (const n of ["notepad", "Microsoft Edge", "7-Zip", "Notepad++", "Adobe Reader (x64)"])
			expect(() => openAppCommand(n, "win32")).not.toThrow();
	});
});

describe("openAppByName", () => {
	it("runs the command and resolves", async () => {
		const run = vi.fn((_f: string, _a: string[], cb: (e: Error | null) => void) => cb(null));
		await openAppByName("notepad", "win32", run);
		expect(run).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", "start", "", "notepad"], expect.any(Function));
	});

	it("rejects when the launcher fails", async () => {
		await expect(openAppByName("nope", "linux", (_f, _a, cb) => cb(new Error("boom")))).rejects.toThrow("boom");
	});
});
