// @vitest-environment jsdom
import { DOT_ICONS } from "@shared/dot-icons";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconPicker } from "./IconPicker";

afterEach(cleanup);

describe("IconPicker", () => {
	it("shows every curated icon and marks the selected one", () => {
		render(<IconPicker value="mail" onChange={() => {}} />);
		expect(screen.getAllByRole("option")).toHaveLength(DOT_ICONS.length);
		expect(screen.getByRole("option", { name: "Mail" }).getAttribute("aria-selected")).toBe("true");
		expect(screen.getByRole("option", { name: "Calendar" }).getAttribute("aria-selected")).toBe("false");
	});

	it("searches by keyword", () => {
		render(<IconPicker value="mail" onChange={() => {}} />);
		fireEvent.change(screen.getByLabelText("Search icons"), { target: { value: "flight" } });
		const names = screen.getAllByRole("option").map((o) => o.getAttribute("aria-label"));
		expect(names).toContain("Plane");
		expect(names).not.toContain("Mail");
	});

	it("says so when nothing matches", () => {
		render(<IconPicker value="mail" onChange={() => {}} />);
		fireEvent.change(screen.getByLabelText("Search icons"), { target: { value: "zzzzqq" } });
		expect(screen.queryAllByRole("option")).toHaveLength(0);
		expect(screen.getByText("No icons found")).toBeTruthy();
	});

	it("reports the chosen key", () => {
		const onChange = vi.fn();
		render(<IconPicker value="mail" onChange={onChange} />);
		fireEvent.click(screen.getByRole("option", { name: "Wallet" }));
		expect(onChange).toHaveBeenCalledWith("wallet");
	});
});
