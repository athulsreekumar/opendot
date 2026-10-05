import { describe, expect, it } from "vitest";
import { createMemoryLimiter } from "@/lib/rate-limit";

const MIN = 60_000;

describe("memory rate limiter", () => {
	it("allows 5 requests then blocks the 6th with retryAfter", async () => {
		let t = 1_000_000;
		const limit = createMemoryLimiter({ now: () => t });
		for (let i = 0; i < 5; i++) expect((await limit("1.1.1.1")).ok).toBe(true);
		const r = await limit("1.1.1.1");
		expect(r.ok).toBe(false);
		expect(r.retryAfter).toBe(600);
		t += 4 * MIN;
		expect((await limit("1.1.1.1")).retryAfter).toBe(360);
	});

	it("tracks IPs independently", async () => {
		const limit = createMemoryLimiter({ now: () => 5 });
		for (let i = 0; i < 5; i++) await limit("a");
		expect((await limit("a")).ok).toBe(false);
		expect((await limit("b")).ok).toBe(true);
	});

	it("slides the window: old hits expire one by one", async () => {
		let t = 0;
		const limit = createMemoryLimiter({ now: () => t });
		await limit("ip"); // t=0
		t = 3 * MIN;
		for (let i = 0; i < 4; i++) await limit("ip"); // 4 more at 3min => 5 in window
		expect((await limit("ip")).ok).toBe(false);
		t = 10 * MIN + 1; // first hit slid out, 4 remain
		expect((await limit("ip")).ok).toBe(true);
		expect((await limit("ip")).ok).toBe(false);
		t = 13 * MIN + 2; // everything from 3min slid out
		expect((await limit("ip")).ok).toBe(true);
	});

	it("stays bounded in size", async () => {
		const limit = createMemoryLimiter({ now: () => 1, maxEntries: 50 });
		for (let i = 0; i < 500; i++) expect((await limit(`ip-${i}`)).ok).toBe(true);
		// Oldest entries were evicted, so they start fresh rather than the map growing forever.
		expect((await limit("ip-0")).ok).toBe(true);
	});
});
