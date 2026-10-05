import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MacDeps } from "./deps";
import { MAC_DEFAULT_DECISIONS, macTools } from "./index";
import { isNotAuthorized, jsString } from "./jxa";
import { checkPath, fileToolPath } from "./path-guard";
import { getMacPermissions, requestMacPermission } from "./permissions";

function makeDeps(
	runJxa: (s: string) => Promise<string> = async () => "[]",
): MacDeps & { runJxa: ReturnType<typeof vi.fn> } {
	return {
		fetch: vi.fn() as unknown as typeof fetch,
		getAccessToken: async () => "",
		runJxa: vi.fn(runJxa),
		now: () => new Date("2026-01-01T00:00:00Z"),
		clipboardRead: () => "clip",
		clipboardWrite: vi.fn(),
		screenshot: async () => ({ base64Png: "QUJD", width: 10, height: 5 }),
		notify: vi.fn(),
		openUrl: vi.fn(async () => {}),
		openApp: vi.fn(async () => {}),
	};
}

// biome-ignore lint/suspicious/noExplicitAny: test helper invoking a tool by name
async function call(tools: any[], name: string, params: Record<string, unknown>) {
	const t = tools.find((x) => x.name === name);
	return t.execute("id", params, undefined, undefined, undefined);
}

describe("macTools", () => {
	it("returns tools only for enabled capabilities", () => {
		const d = makeDeps();
		expect(macTools([], d)).toEqual([]);
		expect(macTools(["files", "shell"], d)).toEqual([]);
		expect(macTools(["calendar"], d).map((t) => t.name)).toEqual(["mac_calendar_events", "mac_calendar_create"]);
		expect(macTools(["reminders"], d).map((t) => t.name)).toEqual([
			"mac_reminders_list",
			"mac_reminders_add",
			"mac_reminders_complete",
		]);
		expect(macTools(["contacts"], d).map((t) => t.name)).toEqual(["mac_contacts_search"]);
		expect(macTools(["notes"], d).map((t) => t.name)).toEqual([
			"mac_notes_search",
			"mac_notes_read",
			"mac_notes_create",
		]);
		expect(macTools(["screen"], d).map((t) => t.name)).toEqual(["mac_screenshot"]);
		expect(macTools(["clipboard"], d).map((t) => t.name)).toEqual(["mac_clipboard_read", "mac_clipboard_write"]);
		expect(macTools(["notifications"], d).map((t) => t.name)).toEqual(["mac_notify"]);
		expect(macTools(["open"], d).map((t) => t.name)).toEqual(["mac_open_url", "mac_open_app"]);
	});

	it("every tool has annotations and a default decision", () => {
		const all = macTools(
			["calendar", "reminders", "contacts", "notes", "screen", "clipboard", "notifications", "open"],
			makeDeps(),
		);
		expect(all.length).toBe(15);
		for (const t of all) {
			expect(t.annotations).toBeDefined();
			expect(MAC_DEFAULT_DECISIONS[t.name]).toBeDefined();
		}
		expect(MAC_DEFAULT_DECISIONS.mac_calendar_create).toBe("ask");
		expect(MAC_DEFAULT_DECISIONS.mac_clipboard_write).toBe("allow");
		expect(MAC_DEFAULT_DECISIONS.bash).toBe("ask");
	});

	it("open_url rejects non-https", async () => {
		const d = makeDeps();
		const tools = macTools(["open"], d);
		await expect(call(tools, "mac_open_url", { url: "http://example.com" })).rejects.toThrow(/https/);
		await expect(call(tools, "mac_open_url", { url: "file:///etc/passwd" })).rejects.toThrow(/https/);
		await call(tools, "mac_open_url", { url: "https://example.com/a" });
		expect(d.openUrl).toHaveBeenCalledWith("https://example.com/a");
	});

	it("notes_create embeds user input only via jsString", async () => {
		const d = makeDeps(async () => JSON.stringify({ ok: true, id: "n1" }));
		const tools = macTools(["notes"], d);
		const evil = `x"); doSomethingBad(); ("`;
		await call(tools, "mac_notes_create", { title: evil, body: 'line1\nline2 "q"' });
		const script = d.runJxa.mock.calls[0]?.[0] as string;
		expect(script).toContain(`const title = ${jsString(evil)};`);
		expect(script).toContain(jsString('line1\nline2 "q"'));
		expect(script).not.toContain(`x"); doSomethingBad()`);
	});

	it("calendar_events parses output and rejects bad dates", async () => {
		const d = makeDeps(async () => JSON.stringify([{ id: "e", title: "Standup" }]));
		const tools = macTools(["calendar"], d);
		const r = await call(tools, "mac_calendar_events", { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" });
		expect(r.content[0].text).toContain("Standup");
		await expect(call(tools, "mac_calendar_events", { from: "nope", to: "2026-01-02" })).rejects.toThrow(/Invalid/);
	});

	it("maps -1743 to a settings hint", async () => {
		const d = makeDeps(async () => {
			throw new Error("execution error: Not authorized to send Apple events to Calendar. (-1743)");
		});
		await expect(call(macTools(["contacts"], d), "mac_contacts_search", { query: "a" })).rejects.toThrow(
			/System Settings/,
		);
	});

	it("screenshot returns image content, clipboard works", async () => {
		const d = makeDeps();
		const r = await call(macTools(["screen"], d), "mac_screenshot", {});
		expect(r.content[0]).toEqual({ type: "image", data: "QUJD", mimeType: "image/png" });
		expect(r.content[1].type).toBe("text");
		const c = macTools(["clipboard"], d);
		expect((await call(c, "mac_clipboard_read", {})).content[0].text).toBe("clip");
		await call(c, "mac_clipboard_write", { text: "hi" });
		expect(d.clipboardWrite).toHaveBeenCalledWith("hi");
	});

	it("isNotAuthorized detects both forms", () => {
		expect(isNotAuthorized(new Error("blah (-1743)"))).toBe(true);
		expect(isNotAuthorized(new Error("Not authorized to send Apple events to Notes"))).toBe(true);
		expect(isNotAuthorized(new Error("timeout"))).toBe(false);
	});
});

describe("path guard", () => {
	let root: string;
	let outside: string;
	beforeEach(async () => {
		const base = await realpath(await mkdtemp(path.join(tmpdir(), "mac-pg-")));
		root = path.join(base, "ws");
		outside = path.join(base, "out");
		await mkdir(root);
		await mkdir(outside);
		await writeFile(path.join(root, "a.txt"), "a");
		await writeFile(path.join(outside, "secret.txt"), "s");
		await symlink(outside, path.join(root, "link"));
	});
	afterEach(async () => {
		await rm(path.dirname(root), { recursive: true, force: true });
	});

	it("allows files inside, including non-existent targets", async () => {
		expect(await checkPath(path.join(root, "a.txt"), [root])).toEqual({ ok: true, resolved: path.join(root, "a.txt") });
		const r = await checkPath(path.join(root, "new", "deep.txt"), [root]);
		expect(r).toEqual({ ok: true, resolved: path.join(root, "new", "deep.txt") });
		expect((await checkPath("a.txt", [root])).ok).toBe(true);
	});

	it("denies outside paths, traversal and symlink escape", async () => {
		const o = await checkPath(path.join(outside, "secret.txt"), [root]);
		expect(o).toEqual({ ok: false, reason: `This Dot can only access: ${root}` });
		expect((await checkPath(path.join(root, "..", "out", "secret.txt"), [root])).ok).toBe(false);
		expect((await checkPath(path.join(root, "link", "secret.txt"), [root])).ok).toBe(false);
		expect((await checkPath(path.join(root, "link", "newfile"), [root])).ok).toBe(false);
	});

	it("allows extra granted roots and expands tilde", async () => {
		expect((await checkPath(path.join(outside, "secret.txt"), [root, outside])).ok).toBe(true);
		expect((await checkPath("~/definitely-not-allowed-xyz", [root])).ok).toBe(false);
	});

	it("fileToolPath extracts path args", () => {
		expect(fileToolPath("read", { path: "a" })).toBe("a");
		expect(fileToolPath("write", { path: "b", content: "" })).toBe("b");
		expect(fileToolPath("edit", { path: "c" })).toBe("c");
		expect(fileToolPath("ls", {})).toBe(".");
		expect(fileToolPath("grep", { pattern: "x" })).toBe(".");
		expect(fileToolPath("find", { pattern: "x", path: "src" })).toBe("src");
		expect(fileToolPath("bash", { command: "ls" })).toBeUndefined();
		expect(fileToolPath("read", {})).toBeUndefined();
	});
});

describe("permissions", () => {
	const base = { mediaStatus: () => "granted", isTrustedAccessibility: () => false, platform: "darwin" };

	it("maps probe results on darwin", async () => {
		const runJxa = vi.fn(async (s: string) => {
			if (s.includes("Calendar")) return "3";
			if (s.includes("Reminders")) throw new Error("Not authorized to send Apple events (-1743)");
			throw new Error("timed out");
		});
		const res = await getMacPermissions({ ...base, runJxa });
		const by = Object.fromEntries(res.map((r) => [r.capability, r]));
		expect(by.calendar?.status).toBe("granted");
		expect(by.reminders?.status).toBe("denied");
		expect(by.reminders?.settingsUrl).toBe("x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders");
		expect(by.contacts?.status).toBe("not-determined");
		expect(by.notes?.settingsUrl).toContain("Privacy_Automation");
		expect(by.screen?.status).toBe("granted");
		expect(by.accessibility?.status).toBe("denied");
		expect(by.clipboard?.status).toBe("not-required");
		expect(by.shell?.status).toBe("not-required");
	});

	it("non-darwin", async () => {
		const res = await getMacPermissions({ ...base, platform: "linux", runJxa: async () => "" });
		const by = Object.fromEntries(res.map((r) => [r.capability, r.status]));
		expect(by.clipboard).toBe("not-required");
		expect(by.files).toBe("not-required");
		for (const c of ["screen", "calendar", "reminders", "contacts", "notes", "accessibility"])
			expect(by[c]).toBe("restricted");
	});

	it("requestMacPermission triggers screen prompt then reports", async () => {
		const requestScreen = vi.fn(async () => {});
		let status = "not-determined";
		const r = await requestMacPermission("screen", {
			...base,
			mediaStatus: () => status,
			runJxa: async () => "",
			requestScreen: async () => {
				await requestScreen();
				status = "granted";
			},
		});
		expect(requestScreen).toHaveBeenCalled();
		expect(r.status).toBe("granted");
		const c = await requestMacPermission("calendar", { ...base, runJxa: async () => "1" });
		expect(c.status).toBe("granted");
	});
});
