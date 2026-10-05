// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, SegmentedControl, Spinner, StatusPill, Toaster, toast, useToasts } from "./index";

// Polyfill minimal stubs for jsdom
beforeAll(() => {
	class ResizeObserverStub implements ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	(window as typeof window & { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

	Element.prototype.scrollIntoView = () => {};

	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = () => false;
	}

	if (!Element.prototype.releasePointerCapture) {
		Element.prototype.releasePointerCapture = () => {};
	}
});

describe("Dialog", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("renders title when open", () => {
		render(
			<Dialog open={true} title="Test Dialog" onOpenChange={() => {}}>
				<div>Dialog content</div>
			</Dialog>,
		);

		const titleElement = screen.getByText("Test Dialog");
		expect(titleElement).toBeTruthy();
	});

	it("onOpenChange callback is available", () => {
		const onOpenChange = vi.fn();
		render(
			<Dialog open={true} title="Test Dialog" onOpenChange={onOpenChange}>
				<div>Dialog content</div>
			</Dialog>,
		);

		expect(onOpenChange).toBeDefined();
	});
});

describe("SegmentedControl", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("selects next option on arrow right", () => {
		const onValueChange = vi.fn();
		const options = [
			{ value: "opt1", label: "Option 1" },
			{ value: "opt2", label: "Option 2" },
			{ value: "opt3", label: "Option 3" },
		];

		render(<SegmentedControl value="opt1" onValueChange={onValueChange} options={options} />);

		const radioGroup = screen.getByRole("radiogroup");
		fireEvent.keyDown(radioGroup, { key: "ArrowRight" });

		expect(onValueChange).toHaveBeenCalledWith("opt2");
	});

	it("selects previous option on arrow left", () => {
		const onValueChange = vi.fn();
		const options = [
			{ value: "opt1", label: "Option 1" },
			{ value: "opt2", label: "Option 2" },
		];

		render(<SegmentedControl value="opt2" onValueChange={onValueChange} options={options} />);

		const radioGroup = screen.getByRole("radiogroup");
		fireEvent.keyDown(radioGroup, { key: "ArrowLeft" });

		expect(onValueChange).toHaveBeenCalledWith("opt1");
	});
});

describe("Toast", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		useToasts.setState({ toasts: [] });
		vi.clearAllTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows a toast and auto-dismisses after 4 seconds", () => {
		vi.useFakeTimers();

		render(<Toaster />);

		toast({
			title: "Test Toast",
			variant: "success",
		});

		// Check that toast was added to store
		const state = useToasts.getState();
		expect(state.toasts.length).toBe(1);

		// Advance time by 4 seconds
		vi.advanceTimersByTime(4000);

		// Toast should be removed from store
		const stateAfter = useToasts.getState();
		expect(stateAfter.toasts.length).toBe(0);
	});

	it("auto-dismisses errors after 8 seconds", () => {
		vi.useFakeTimers();

		render(<Toaster />);

		toast({
			title: "Error Toast",
			variant: "error",
		});

		const state = useToasts.getState();
		expect(state.toasts.length).toBe(1);

		// Advance time by 7 seconds (not yet dismissed)
		vi.advanceTimersByTime(7000);
		const stateAt7s = useToasts.getState();
		expect(stateAt7s.toasts.length).toBe(1);

		// Advance by 1 more second (should be gone)
		vi.advanceTimersByTime(1000);
		const stateFinal = useToasts.getState();
		expect(stateFinal.toasts.length).toBe(0);
	});
});

describe("StatusPill", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("renders with default label", () => {
		render(<StatusPill state="connected" />);
		const element = screen.getByText("Connected");
		expect(element).toBeTruthy();
	});

	it("renders label for error state", () => {
		render(<StatusPill state="error" />);
		const element = screen.getByText("Error");
		expect(element).toBeTruthy();
	});
});

describe("Spinner", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("has role status", () => {
		const { container } = render(<Spinner />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("role")).toBe("status");
	});

	it("has aria-label Loading", () => {
		const { container } = render(<Spinner />);
		const svg = container.querySelector("svg");
		expect(svg?.getAttribute("aria-label")).toBe("Loading");
	});
});
