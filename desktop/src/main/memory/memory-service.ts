// Persistent memory: per-Dot memory.json + shared "About me" (spec 02 §2.1).
import { LIMITS } from "../../shared/defaults";
import { OpenDotError } from "../../shared/errors";
import { newId } from "../../shared/ids";
import type { DotId, DotMemory, MemoryItem } from "../../shared/types";
import type { JsonFile } from "../store/json-file";
import type { Store } from "../store/store";

export type MemoryScope = DotId | "user";

export class MemoryService {
	constructor(private readonly store: Store) {}

	private file(scope: MemoryScope): JsonFile<DotMemory> {
		return scope === "user" ? this.store.userMemory : this.store.dotMemory(scope);
	}

	async list(scope: MemoryScope): Promise<MemoryItem[]> {
		return (await this.file(scope).read()).items;
	}

	async upsert(
		scope: MemoryScope,
		input: { id?: string; text: string; pinned?: boolean },
		source: "user" | "dot" = "user",
	): Promise<MemoryItem> {
		const text = input.text.trim().slice(0, LIMITS.memoryItemMax);
		if (!text) throw new OpenDotError("EMPTY", "Memory text is empty.");
		const now = new Date().toISOString();
		let saved: MemoryItem | undefined;
		await this.file(scope).update((m) => {
			const items = [...m.items];
			const i = input.id ? items.findIndex((x) => x.id === input.id) : -1;
			if (i >= 0) {
				saved = { ...items[i]!, text, pinned: input.pinned ?? items[i]!.pinned, updatedAt: now };
				items[i] = saved;
			} else {
				const dup = items.find((x) => x.text.toLowerCase() === text.toLowerCase());
				if (dup) {
					saved = dup;
					return m;
				}
				saved = { id: newId("mem"), text, pinned: input.pinned ?? false, createdAt: now, updatedAt: now, source };
				items.push(saved);
				const max = scope === "user" ? LIMITS.userMemoryItems : LIMITS.dotMemoryItems;
				while (items.length > max) {
					const oldest = items.findIndex((x) => !x.pinned);
					if (oldest < 0) break;
					items.splice(oldest, 1);
				}
			}
			return { items };
		});
		return saved!;
	}

	async remove(scope: MemoryScope, id: string): Promise<boolean> {
		let found = false;
		await this.file(scope).update((m) => {
			found = m.items.some((x) => x.id === id);
			return { items: m.items.filter((x) => x.id !== id) };
		});
		return found;
	}

	async search(dotId: DotId, query: string): Promise<Array<MemoryItem & { scope: "user" | "dot" }>> {
		const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
		const all = [
			...(await this.list("user")).map((m) => ({ ...m, scope: "user" as const })),
			...(await this.list(dotId)).map((m) => ({ ...m, scope: "dot" as const })),
		];
		return all.filter((m) => terms.every((t) => m.text.toLowerCase().includes(t))).slice(0, 20);
	}

	/** Prompt text: pinned first, then newest, cut at `max` chars. */
	static render(items: MemoryItem[], max: number): string {
		const sorted = [...items].sort(
			(a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
		);
		const lines: string[] = [];
		let len = 0;
		for (const m of sorted) {
			const line = `- (${m.id}) ${m.text}`;
			if (len + line.length > max) break;
			lines.push(line);
			len += line.length + 1;
		}
		return lines.join("\n");
	}
}
