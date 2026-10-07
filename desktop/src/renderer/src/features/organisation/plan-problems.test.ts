import type { OrgTaskInput } from "@shared/organisation";
import { describe, expect, it } from "vitest";
import { friendlyProblem } from "./plan-problems";

const task = (id: string): OrgTaskInput => ({ id, title: id, brief: "b", assignee: "human", dependsOn: [] });

describe("friendlyProblem", () => {
	it("names tasks by their row on the screen, not by id", () => {
		const tasks = [task("a"), task("t7"), task("t9")];
		expect(friendlyProblem("Task t9 has no title.", tasks)).toBe("Task 3 has no title.");
		expect(friendlyProblem('Task t7 depends on "a", which doesn\'t exist.', tasks)).toBe(
			"Task 2 depends on task 1, which doesn't exist.",
		);
	});

	it("does not chain replacements when ids look like row numbers", () => {
		const tasks = [task("2"), task("1")];
		expect(friendlyProblem("Task 1 has no brief.", tasks)).toBe("Task 2 has no brief.");
	});

	it("leaves messages without task ids alone", () => {
		expect(friendlyProblem("The tasks depend on each other in a circle.", [task("t1")])).toBe(
			"The tasks depend on each other in a circle.",
		);
	});
});
