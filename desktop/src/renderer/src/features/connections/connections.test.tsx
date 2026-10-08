// @vitest-environment jsdom

import type { Dot } from "@shared/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const upsert = vi.fn(async (input: Record<string, unknown>) => ({ ...input, id: "lnk_1", createdAt: "2026-01-01" }));
const importJson = vi.fn();

vi.mock("@/lib/api", () => ({
	api: {
		links: {
			upsert: (i: Record<string, unknown>) => upsert(i),
			simulate: vi.fn(async () => ({ allowed: true, reason: "ok" })),
		},
		connections: {
			importJson: (j: string) => importJson(j),
			list: vi.fn(async () => []),
			status: vi.fn(async () => []),
		},
		app: { openExternal: vi.fn() },
	},
	errorText: (e: unknown) => String(e),
}));

import { useDots } from "@/stores/dots";
import { LinkRuleEditor } from "../links/LinkRuleEditor";
import { ImportJsonDialog, parseMcpJson } from "./ImportJsonDialog";

beforeAll(() => {
	class RO {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	(window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
	Element.prototype.scrollIntoView = () => {};
	Element.prototype.hasPointerCapture = () => false;
	Element.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const CLAUDE_DESKTOP = JSON.stringify({
	mcpServers: {
		github: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"], env: { GITHUB_TOKEN: "ghp_x" } },
		remote: { url: "https://example.com/mcp" },
	},
});

describe("ImportJsonDialog", () => {
	it("parses a Claude Desktop mcpServers JSON", () => {
		const p = parseMcpJson(CLAUDE_DESKTOP);
		expect(p.servers.map((s) => [s.name, s.kind])).toEqual([
			["github", "stdio"],
			["remote", "http"],
		]);
		expect(parseMcpJson("{nope").error).toBeTruthy();
	});

	it("shows a preview and imports", async () => {
		importJson.mockResolvedValue({ added: [{ label: "github" }], errors: [] });
		render(<ImportJsonDialog open onOpenChange={() => {}} />);
		fireEvent.change(screen.getByLabelText("mcpServers JSON"), { target: { value: CLAUDE_DESKTOP } });
		expect(await screen.findByText("Found 2 servers")).toBeTruthy();
		expect(screen.getByText("github")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Import" }));
		await waitFor(() => expect(importJson).toHaveBeenCalled());
		expect(Object.keys(JSON.parse(importJson.mock.calls[0]?.[0]).mcpServers)).toEqual(["github", "remote"]);
	});
});

describe("LinkRuleEditor", () => {
	it("submits upsert with the chosen subjects", async () => {
		useDots.setState({
			dots: [
				{
					id: "dot_a",
					kind: "standard",
					name: "A",
					archived: false,
					roles: ["finance"],
					appearance: { icon: "mail", color: "teal" },
				} as unknown as Dot,
			],
		});
		const onSaved = vi.fn();
		render(
			<LinkRuleEditor
				open
				onOpenChange={() => {}}
				onSaved={onSaved}
				initial={{ from: { kind: "dot", dotId: "dot_a" }, to: { kind: "role", role: "finance" } }}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
		await waitFor(() => expect(upsert).toHaveBeenCalled());
		const arg = upsert.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(arg.from).toEqual({ kind: "dot", dotId: "dot_a" });
		expect(arg.to).toEqual({ kind: "role", role: "finance" });
		expect(arg).toMatchObject({ effect: "allow", approval: "ask", maxPerHour: 10, sharePii: false });
		expect(arg.schedule).toBeUndefined();
	});
});
