// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
	errorText: (e: unknown) => String(e),
	api: {
		models: {
			builtinProviders: vi.fn(async () => [
				{ id: "anthropic", label: "Anthropic", keyUrl: "https://example.com/key", featured: true },
				{ id: "openai", label: "OpenAI", featured: true },
			]),
			detectLocal: vi.fn(async () => []),
			addProvider: vi.fn(async (i: { kind: string }) => ({ id: "anthropic", label: "Anthropic", kind: i.kind })),
			listProviders: vi.fn(async () => []),
			listModels: vi.fn(async () => []),
		},
		app: { openExternal: vi.fn() },
	},
}));

import { api } from "@/lib/api";
import { AddProviderDialog } from "./AddProviderDialog";
import { SettingsNav } from "./SettingsNav";

afterEach(() => {
	cleanup();
});

describe("SettingsNav", () => {
	it("navigates to the section hash", () => {
		render(<SettingsNav section="models" />);
		fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
		expect(window.location.hash).toBe("#/settings/privacy");
		expect(screen.getByRole("button", { name: "Models" }).getAttribute("aria-current")).toBe("page");
	});
});

describe("AddProviderDialog", () => {
	it("submits a cloud provider with the key", async () => {
		const onOpenChange = vi.fn();
		render(<AddProviderDialog open onOpenChange={onOpenChange} />);
		const key = await screen.findByPlaceholderText("Paste your key");
		fireEvent.change(key, { target: { value: "sk-test-123" } });
		const submit = screen.getByRole("button", { name: "Add provider" }) as HTMLButtonElement;
		await waitFor(() => expect((key as HTMLInputElement).value).toBe("sk-test-123"));
		await waitFor(() => expect(submit.disabled).toBe(false));
		fireEvent.click(submit);
		await waitFor(() =>
			expect(api.models.addProvider).toHaveBeenCalledWith({
				kind: "cloud",
				builtinProviderId: "anthropic",
				apiKey: "sk-test-123",
			}),
		);
	});
});
