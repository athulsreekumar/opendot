import { describe, expect, it } from "vitest";
import type { Connection } from "../../shared/types";
import { MAC_DEFAULT_DECISIONS } from "./mac";
import { nativeToolCatalog } from "./native-catalog";

const base = { enabled: true, exposure: "direct", toolExposure: {}, createdAt: "2026-01-01T00:00:00Z" } as const;
const conn = (type: Connection["type"], features: string[]): Connection =>
	({ ...base, id: `con_${type}`, type, name: type, label: type, features }) as unknown as Connection;

describe("nativeToolCatalog", () => {
	it("lists every This Mac tool, including file and shell tools", () => {
		const all = Object.keys(MAC_DEFAULT_DECISIONS);
		const names = nativeToolCatalog(
			conn("mac", [
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
			]),
			"darwin",
		).map((t) => t.name);
		expect(names.sort()).toEqual([...all].sort());
	});

	it("on Windows lists files, shell, screen, clipboard, notifications and open, but no Calendar, Reminders, Contacts or Notes", () => {
		const every = [
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
		const names = nativeToolCatalog(conn("mac", every), "win32", true).map((t) => t.name);
		expect(names.sort()).toEqual(
			[
				"read",
				"ls",
				"find",
				"grep",
				"write",
				"edit",
				"bash",
				"mac_screenshot",
				"mac_clipboard_read",
				"mac_clipboard_write",
				"mac_notify",
				"mac_open_url",
				"mac_open_app",
			].sort(),
		);
	});

	it("on Windows without Git Bash leaves out the shell tool", () => {
		const names = nativeToolCatalog(conn("mac", ["files", "shell"]), "win32", false).map((t) => t.name);
		expect(names).not.toContain("bash");
		expect(names).toContain("read");
	});

	it("only lists tools for enabled features", () => {
		const tools = nativeToolCatalog(conn("mac", ["calendar"]), "darwin");
		expect(tools.map((t) => t.name).sort()).toEqual(["mac_calendar_create", "mac_calendar_events"]);
		expect(tools.find((t) => t.name === "mac_calendar_events")?.readOnly).toBe(true);
	});

	it("lists Google and Microsoft tools even before sign-in", () => {
		expect(nativeToolCatalog(conn("google", [])).some((t) => t.name.startsWith("gmail_"))).toBe(true);
		expect(nativeToolCatalog(conn("microsoft", [])).some((t) => t.name.startsWith("outlook_"))).toBe(true);
	});

	it("returns nothing for MCP connections", () => {
		expect(nativeToolCatalog(conn("mcp-stdio", []))).toEqual([]);
	});
});
