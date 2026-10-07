import { describe, expect, it } from "vitest";
import { Bm25Index, terms } from "./search";

describe("Bm25Index", () => {
	const idx = new Bm25Index();
	idx.add(1, "Quarterly budget review: revenue and costs for the sales team");
	idx.add(2, "Recipe for sourdough bread with rye flour and a long overnight proof");
	idx.add(3, "Budget budget budget travel expenses");
	idx.add(4, "Meeting notes about the sourdough starter feeding schedule");

	it("ranks the best match first", () => {
		expect(idx.search("sourdough bread flour", 3)[0]!.id).toBe(2);
		expect(idx.search("sourdough", 3).map((r) => r.id)).toEqual(expect.arrayContaining([2, 4]));
	});

	it("prefers rarer terms and higher term frequency", () => {
		const r = idx.search("budget revenue", 3);
		expect(r[0]!.id).toBe(1);
		expect(r.map((x) => x.id)).toContain(3);
	});

	it("folds simple plurals and ignores stop words", () => {
		expect(terms("The Notes of the budgets")).toEqual(["note", "budget"]);
		expect(idx.search("recipes", 3)[0]?.id).toBe(2);
	});

	it("returns nothing for unknown or empty queries", () => {
		expect(idx.search("zzzz", 5)).toEqual([]);
		expect(idx.search("the of", 5)).toEqual([]);
		expect(new Bm25Index().search("anything", 5)).toEqual([]);
	});

	it("supports replacing and removing documents", () => {
		const i = new Bm25Index();
		i.add(1, "alpha beta");
		i.add(2, "gamma delta");
		i.add(1, "epsilon zeta");
		expect(i.search("alpha", 5)).toEqual([]);
		expect(i.search("epsilon", 5)[0]!.id).toBe(1);
		i.remove(2);
		expect(i.search("gamma", 5)).toEqual([]);
		expect(i.size).toBe(1);
	});
});
