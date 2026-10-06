import { describe, expect, it } from "vitest";
import { hero, MAC_ONLY } from "@/lib/copy";

describe("copy deck", () => {
	it("has the hero headline and the platform label", () => {
		expect(hero.h1).toEqual(["Your AI team.", "Living on your Mac."]);
		expect(MAC_ONLY.label).toBe("For Mac and Windows");
	});
});
