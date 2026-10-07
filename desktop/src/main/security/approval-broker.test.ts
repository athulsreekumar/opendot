import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalBroker, type ApprovalResolution } from "./approval-broker";

function make() {
	const resolved: ApprovalResolution[] = [];
	const broker = new ApprovalBroker({ requested: () => undefined, resolved: (_i, _d, _r, res) => resolved.push(res) });
	const base = { kind: "tool" as const, dotId: "dot_a" as const, title: "t", detail: "" };
	return { broker, resolved, base };
}

afterEach(() => vi.useRealTimers());

describe("ApprovalBroker", () => {
	it("passes a deny reason and edited arguments back to the requester", async () => {
		const { broker, base } = make();
		const p1 = broker.requestDetailed(base);
		broker.respond({ id: broker.pending()[0]!.id, decision: "deny", reason: "  too risky " });
		expect(await p1).toMatchObject({ outcome: "deny", reason: "too risky", by: "you" });

		const p2 = broker.requestDetailed(base);
		broker.respond({
			id: broker.pending()[0]!.id,
			decision: "allow-once",
			editedArgs: { body: "x" },
			reason: "ignored",
		});
		const r2 = await p2;
		expect(r2).toMatchObject({ outcome: "allow-once", editedArgs: { body: "x" } });
		expect(r2.reason).toBeUndefined();
	});

	it("request() still returns just the outcome", async () => {
		const { broker, base } = make();
		const p = broker.request(base);
		broker.respond({ id: broker.pending()[0]!.id, decision: "allow-always" });
		expect(await p).toBe("allow-always");
	});

	it("denies all of one Dot's requests", async () => {
		const { broker, base, resolved } = make();
		const a = broker.requestDetailed(base);
		const b = broker.requestDetailed(base);
		const c = broker.requestDetailed({ ...base, dotId: "dot_b" });
		expect(broker.denyAll("dot_a", "later")).toBe(2);
		expect((await a).outcome).toBe("deny");
		expect((await b).reason).toBe("later");
		expect(broker.pending()).toHaveLength(1);
		expect(resolved).toHaveLength(2);
		broker.cancelForDot("dot_b");
		expect(await c).toMatchObject({ outcome: "deny", by: "stopped" });
	});

	it("expires with by=timeout", async () => {
		vi.useFakeTimers();
		const { broker, base } = make();
		const p = broker.requestDetailed(base, { ttlMs: 1000 });
		vi.advanceTimersByTime(1000);
		expect(await p).toMatchObject({ outcome: "expired", by: "timeout" });
	});
});
