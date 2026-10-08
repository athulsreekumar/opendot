// @vitest-environment jsdom

import type { Connection, ConnectorChoice, Dot, DotTemplate } from "@shared/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const choices: ConnectorChoice[] = [
	{ id: "google:gmail", label: "Gmail", kind: "available", icon: "mail", group: "Google" },
	{ id: "con_1", label: "Notes MCP", kind: "installed", icon: "tool", group: "MCP" },
];
const template: DotTemplate = {
	id: "inbox",
	name: "Inbox",
	category: "Productivity",
	description: "Email triage",
	examplePrompt: "Triage my email every morning and draft replies.",
	draft: {
		name: "Inbox",
		tagline: "",
		appearance: { icon: "mail", color: "blue" },
		persona: {
			role: "r",
			tone: "direct",
			verbosity: 30,
			formality: 50,
			emojiUsage: 0,
			quirks: [],
			dos: [],
			donts: [],
			customInstructions: "",
			greeting: "",
		},
		suggestedConnections: ["google:gmail"],
	},
};

const { apiMock } = vi.hoisted(() => ({
	apiMock: {
		dots: {
			templates: vi.fn(),
			alwaysAllowed: vi.fn(async () => []),
			forgetAllowed: vi.fn(),
			connectorChoices: vi.fn(),
			draftFromDescription: vi.fn(),
			update: vi.fn(),
			list: vi.fn(),
		},
		on: vi.fn(() => () => undefined),
		app: { pickFolder: vi.fn() },
	},
}));

vi.mock("@/lib/api", () => ({
	api: apiMock,
	errorText: (e: unknown) => String((e as { message?: string })?.message ?? e),
}));

import { useDots } from "@/stores/dots";
import { useRuntime } from "@/stores/runtime";
import { DescribeStep } from "../new-dot/DescribeStep";
import { parsePartialJson } from "../new-dot/partial-json";
import { ToolsSection } from "./ToolsSection";

beforeAll(() => {
	class RO {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	(window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

afterEach(cleanup);

describe("DescribeStep", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		apiMock.on.mockReturnValue(() => undefined);
		apiMock.dots.templates.mockResolvedValue([template]);
		apiMock.dots.connectorChoices.mockResolvedValue(choices);
	});

	it("requires at least 10 characters", async () => {
		render(<DescribeStep onDraft={() => undefined} />);
		fireEvent.change(screen.getByLabelText("What should this Dot do?"), { target: { value: "short" } });
		fireEvent.click(screen.getByRole("button", { name: /create personality/i }));
		expect(await screen.findByText(/at least 10 characters/i)).toBeTruthy();
		expect(apiMock.dots.draftFromDescription).not.toHaveBeenCalled();
	});

	it("fills prompt and connectors from a template chip, then drafts", async () => {
		const onDraft = vi.fn();
		apiMock.dots.draftFromDescription.mockResolvedValue(template.draft);
		render(<DescribeStep onDraft={onDraft} />);
		fireEvent.click(await screen.findByRole("button", { name: /Inbox/ }));
		const area = screen.getByLabelText("What should this Dot do?") as HTMLTextAreaElement;
		expect(area.value).toBe(template.examplePrompt);
		const gmail = await screen.findByRole("button", { name: /Gmail/ });
		expect(gmail.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: /create personality/i }));
		await waitFor(() => expect(onDraft).toHaveBeenCalled());
		expect(apiMock.dots.draftFromDescription.mock.calls[0]?.[0].connectors.map((c: ConnectorChoice) => c.id)).toEqual([
			"google:gmail",
		]);
	});
});

describe("parsePartialJson", () => {
	it("reads fields from an unfinished object", () => {
		expect(parsePartialJson('{"name":"Inbox","icon":"mail","tagline":"Your cal')).toEqual({
			name: "Inbox",
			icon: "mail",
			tagline: "Your cal",
		});
		expect(parsePartialJson('```json\n{"name":"A","roles":["x","y')).toEqual({ name: "A", roles: ["x", "y"] });
		expect(parsePartialJson('{"name":"A","tag')).toEqual({ name: "A" });
		expect(parsePartialJson("no json")).toBeUndefined();
	});
});

describe("ToolsSection", () => {
	it("adds a grant when a connection is switched on", async () => {
		const conn = {
			id: "con_gmail",
			type: "mcp-stdio",
			name: "gmail",
			label: "Gmail",
			description: "Mail",
			icon: "mail",
			enabled: true,
			exposure: "direct",
			toolExposure: {},
			features: [],
			createdAt: "2026-01-01T00:00:00Z",
		} as Connection;
		const dot = { id: "dot_a", kind: "standard", name: "A", grants: [], persona: {} } as unknown as Dot;
		useDots.setState({ dots: [dot] });
		useRuntime.setState({ connections: [conn], connectionStatus: {} });
		apiMock.dots.update.mockImplementation(async (_id: string, patch: Partial<Dot>) => ({ ...dot, ...patch }));

		render(<ToolsSection dot={dot} />);
		fireEvent.click(screen.getByRole("switch", { name: "Allow Gmail" }));

		expect(useDots.getState().byId("dot_a")?.grants).toEqual([{ connectionId: "con_gmail", toolRules: {} }]);
		await waitFor(() =>
			expect(apiMock.dots.update).toHaveBeenCalledWith("dot_a", {
				grants: [{ connectionId: "con_gmail", toolRules: {} }],
			}),
		);
	});
});
