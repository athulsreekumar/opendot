// @vitest-environment jsdom
import { DOT_ICON_KEYS } from "@shared/dot-icons";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DOT_ICON_COMPONENTS, DotIcon, dotIconComponent } from "./dot-icon-map";

afterEach(cleanup);

describe("dot icon map", () => {
	it("has a lucide component for every key in the curated set, and nothing else", () => {
		expect(Object.keys(DOT_ICON_COMPONENTS).sort()).toEqual([...DOT_ICON_KEYS].sort());
		for (const k of DOT_ICON_KEYS) expect(DOT_ICON_COMPONENTS[k], k).toBeTruthy();
	});

	it("every key renders an svg", () => {
		for (const k of DOT_ICON_KEYS) {
			const { container, unmount } = render(<DotIcon name={k} />);
			expect(container.querySelector("svg"), k).toBeTruthy();
			unmount();
		}
	});

	it("unknown or missing keys use the neutral default", () => {
		expect(dotIconComponent("nope")).toBe(dotIconComponent(undefined));
		expect(dotIconComponent("nope")).toBe(DOT_ICON_COMPONENTS.message);
	});

	it("is decorative (aria-hidden)", () => {
		const { container } = render(<DotIcon name="mail" />);
		expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
	});
});
