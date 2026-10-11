import { afterEach, describe, expect, it, vi } from "vitest";
import { workingTimeout } from "./link-bus";

afterEach(() => vi.useRealTimers());

describe("workingTimeout", () => {
	it("times out after the working time", () => {
		vi.useFakeTimers();
		const t = workingTimeout(5000, () => false);
		vi.advanceTimersByTime(4000);
		expect(t.signal.aborted).toBe(false);
		vi.advanceTimersByTime(1000);
		expect(t.signal.aborted).toBe(true);
		expect((t.signal.reason as Error).name).toBe("TimeoutError");
	});

	it("does not count time spent waiting for the user", () => {
		vi.useFakeTimers();
		let waiting = false;
		const t = workingTimeout(5000, () => waiting);
		vi.advanceTimersByTime(3000);
		waiting = true;
		vi.advanceTimersByTime(60 * 60_000);
		expect(t.signal.aborted).toBe(false);
		waiting = false;
		vi.advanceTimersByTime(2000);
		expect(t.signal.aborted).toBe(true);
	});

	it("stops counting once disposed", () => {
		vi.useFakeTimers();
		const t = workingTimeout(1000, () => false);
		t.dispose();
		vi.advanceTimersByTime(5000);
		expect(t.signal.aborted).toBe(false);
	});
});
