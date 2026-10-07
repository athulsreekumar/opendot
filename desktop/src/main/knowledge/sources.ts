// Reads the citation sources a knowledge tool attached to its result (`details.sources`).
import type { KnowledgeSourceView } from "../../shared/types";

export function sourcesFromDetails(toolName: string, details: unknown): KnowledgeSourceView[] | undefined {
	if (toolName !== "knowledge_search" && toolName !== "knowledge_read") return undefined;
	const raw = (details as { sources?: unknown } | null | undefined)?.sources;
	if (!Array.isArray(raw)) return undefined;
	const out: KnowledgeSourceView[] = [];
	for (const s of raw.slice(0, 40) as Array<Record<string, unknown>>) {
		if (typeof s?.path !== "string" || typeof s.name !== "string") continue;
		out.push({
			path: s.path,
			name: s.name,
			heading: typeof s.heading === "string" && s.heading ? s.heading : undefined,
			startLine: typeof s.startLine === "number" ? s.startLine : 1,
			endLine: typeof s.endLine === "number" ? s.endLine : 1,
		});
	}
	return out.length ? out : undefined;
}
