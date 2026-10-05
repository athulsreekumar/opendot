import type { MemoryItem } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/design-system/cn";
import { Button, IconButton, Input, Spinner, toast } from "@/design-system/components";
import { IconPin, IconPlus, IconTrash } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { Card } from "./parts";

const fail = (e: unknown) => toast({ title: "Couldn't save", description: errorText(e), variant: "error" });

export function AboutMeSettings() {
	const [items, setItems] = useState<MemoryItem[] | undefined>();
	const [editing, setEditing] = useState<string | undefined>();
	const [draft, setDraft] = useState("");
	const [adding, setAdding] = useState("");

	const load = useCallback(() => {
		api.memory.get("user").then(setItems).catch(fail);
	}, []);
	useEffect(load, [load]);

	const commitEdit = async (item: MemoryItem) => {
		const text = draft.trim();
		setEditing(undefined);
		if (!text || text === item.text) return;
		try {
			await api.memory.upsert("user", { id: item.id, text, pinned: item.pinned });
			load();
		} catch (e) {
			fail(e);
		}
	};
	const add = async () => {
		const text = adding.trim();
		if (!text) return;
		try {
			await api.memory.upsert("user", { text });
			setAdding("");
			load();
		} catch (e) {
			fail(e);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<p className="text-md text-fg-2">
				Things every Dot knows about you. Dots can add to this when you tell them something worth remembering.
			</p>
			<Card>
				{!items ? (
					<Spinner />
				) : items.length === 0 ? (
					<p className="text-sm text-fg-3">Nothing yet.</p>
				) : (
					<ul className="flex flex-col divide-y divide-border-subtle">
						{items.map((m) => (
							<li key={m.id} className="flex items-center gap-2 py-2">
								{editing === m.id ? (
									<Input
										autoFocus
										aria-label="Edit memory"
										value={draft}
										onChange={(e) => setDraft(e.target.value)}
										onBlur={() => void commitEdit(m)}
										onKeyDown={(e) => {
											if (e.key === "Enter") void commitEdit(m);
											if (e.key === "Escape") setEditing(undefined);
										}}
									/>
								) : (
									<button
										type="button"
										className="flex-1 text-left text-md text-fg hover:bg-hover rounded-sm px-1 py-0.5"
										onClick={() => {
											setEditing(m.id);
											setDraft(m.text);
										}}
									>
										{m.text}
										{m.source === "dot" && <span className="ml-2 text-xs text-fg-3">added by a Dot</span>}
									</button>
								)}
								<IconButton
									label={m.pinned ? "Unpin memory" : "Pin memory"}
									size="sm"
									className={cn(m.pinned && "text-accent")}
									icon={<IconPin size={14} />}
									onClick={() =>
										api.memory.upsert("user", { id: m.id, text: m.text, pinned: !m.pinned }).then(load).catch(fail)
									}
								/>
								<IconButton
									label="Delete memory"
									size="sm"
									icon={<IconTrash size={14} />}
									onClick={() => api.memory.remove("user", m.id).then(load).catch(fail)}
								/>
							</li>
						))}
					</ul>
				)}
				<div className="flex gap-2">
					<Input
						aria-label="Add memory"
						placeholder="e.g. I prefer short answers"
						value={adding}
						onChange={(e) => setAdding(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") void add();
						}}
					/>
					<Button
						variant="secondary"
						leadingIcon={<IconPlus size={14} />}
						disabled={!adding.trim()}
						onClick={() => void add()}
					>
						Add memory
					</Button>
				</div>
			</Card>
		</div>
	);
}
