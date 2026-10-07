import type { ChatMessageView, KnowledgeSourceView, ToolCallView } from "@shared/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({ api: {}, errorText: (e: unknown) => String(e) }));

import type { DotChat } from "../../stores/chat";
import { chipLabel, dedupeSources, pickCited, runSourcesKey } from "./KnowledgeSources";

const src = (name: string, heading?: string, path = `/n/${name}`): KnowledgeSourceView => ({
	path,
	name,
	heading,
	startLine: 1,
	endLine: 4,
});
const tool = (sources: KnowledgeSourceView[], status: ToolCallView["status"] = "done"): ToolCallView => ({
	id: "t",
	name: "knowledge_search",
	label: "Knowledge · search",
	args: {},
	status,
	startedAt: "2026-01-01T00:00:00Z",
	sources,
});
const msg = (
	id: string,
	role: ChatMessageView["role"],
	toolCalls: ToolCallView[] = [],
	streaming = false,
): ChatMessageView => ({
	id,
	dotId: "dot_x",
	role,
	text: "x",
	toolCalls,
	createdAt: "2026-01-01T00:00:00Z",
	streaming,
});
const chat = (...ms: ChatMessageView[]): DotChat => ({
	byId: Object.fromEntries(ms.map((m) => [m.id, m])),
	order: ms.map((m) => m.id),
	hasMore: false,
	loading: false,
	loaded: true,
	seq: {},
	needsResync: {},
	pendingNonces: {},
});

describe("runSourcesKey", () => {
	const a = src("a.md", "Intro");
	it("puts the sources of the whole run on the answering message only", () => {
		const c = chat(msg("u", "user"), msg("a1", "assistant", [tool([a])]), msg("a2", "assistant"));
		expect(runSourcesKey(c, "a1")).toBe("");
		expect(JSON.parse(runSourcesKey(c, "a2"))).toEqual([a]);
	});

	it("stops at the previous user message and skips streaming or unfinished tools", () => {
		const old = src("old.md");
		const c = chat(
			msg("a0", "assistant", [tool([old])]),
			msg("u", "user"),
			msg("a1", "assistant", [tool([a], "running")]),
			msg("a2", "assistant"),
		);
		expect(runSourcesKey(c, "a2")).toBe("");
		expect(runSourcesKey(chat(msg("u", "user"), msg("a", "assistant", [], true)), "a")).toBe("");
		expect(runSourcesKey(c, "missing")).toBe("");
		expect(runSourcesKey(undefined, "a2")).toBe("");
	});
});

describe("citation chips", () => {
	it("dedupes and drops bare entries when the file has a heading entry", () => {
		const list = [src("a.md", "One"), src("a.md", "One"), src("a.md"), src("b.md"), src("a.md", "Two")];
		expect(dedupeSources(list).map(chipLabel)).toEqual(["a.md · One", "b.md", "a.md · Two"]);
	});

	it("prefers files the answer names", () => {
		const list = [src("a.md", "One"), src("budget.txt")];
		expect(pickCited(list, "As noted in Budget.txt, costs fell.").map((s) => s.name)).toEqual(["budget.txt"]);
		expect(pickCited(list, "No names here.")).toHaveLength(2);
	});
});
