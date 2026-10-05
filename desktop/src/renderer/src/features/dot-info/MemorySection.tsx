import type { Dot, MemoryItem } from "@shared/types";
import { useEffect, useState } from "react";
import { Button, IconButton, Input, toast } from "@/design-system/components";
import { IconPin, IconPlus, IconTrash } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { SectionCard } from "./ui";

export function MemorySection({ dot }: { dot: Dot }) {
	const [items, setItems] = useState<MemoryItem[]>([]);
	const [text, setText] = useState("");
	const [editing, setEditing] = useState<string>();
	const [draft, setDraft] = useState("");

	useEffect(() => {
		let alive = true;
		void Promise.resolve()
			.then(() => api.memory.get(dot.id))
			.then((l) => alive && setItems(l))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, [dot.id]);

	const upsert = async (item: { id?: string; text: string; pinned?: boolean }) => {
		try {
			const saved = await api.memory.upsert(dot.id, item);
			setItems((l) =>
				l.some((x) => x.id === saved.id) ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved],
			);
		} catch (e) {
			toast({ title: "Couldn't save the memory", description: errorText(e), variant: "error" });
		}
	};

	const remove = async (id: string) => {
		try {
			await api.memory.remove(dot.id, id);
			setItems((l) => l.filter((x) => x.id !== id));
		} catch (e) {
			toast({ title: "Couldn't delete the memory", description: errorText(e), variant: "error" });
		}
	};

	const sorted = [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned));

	return (
		<SectionCard
			title="Memory"
			description={`Things ${dot.name} remembers about you and your work.`}
			testId="section-memory"
		>
			{sorted.length === 0 && (
				<p className="text-sm text-fg-3">Nothing remembered yet. Ask it to remember something, or add a note below.</p>
			)}
			<ul className="flex flex-col gap-1.5">
				{sorted.map((m) => (
					<li key={m.id} className="flex items-center gap-2 rounded-md bg-sunken px-3 py-2">
						{editing === m.id ? (
							<Input
								aria-label="Edit memory"
								autoFocus
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && draft.trim()) {
										void upsert({ id: m.id, text: draft.trim(), pinned: m.pinned });
										setEditing(undefined);
									} else if (e.key === "Escape") setEditing(undefined);
								}}
								onBlur={() => setEditing(undefined)}
							/>
						) : (
							<button
								type="button"
								className="od-selectable min-w-0 flex-1 text-left text-sm text-fg"
								onClick={() => {
									setEditing(m.id);
									setDraft(m.text);
								}}
							>
								{m.text}
								{m.source === "dot" && <span className="ml-1 text-2xs text-fg-3">· remembered by {dot.name}</span>}
							</button>
						)}
						<IconButton
							label={m.pinned ? "Unpin memory" : "Pin memory"}
							size="sm"
							icon={<IconPin size={14} className={m.pinned ? "text-accent" : "text-fg-3"} />}
							onClick={() => void upsert({ id: m.id, text: m.text, pinned: !m.pinned })}
						/>
						<IconButton
							label="Delete memory"
							size="sm"
							icon={<IconTrash size={14} />}
							onClick={() => void remove(m.id)}
						/>
					</li>
				))}
			</ul>
			<div className="flex items-center gap-2">
				<Input
					aria-label="New memory"
					value={text}
					placeholder="Add something to remember"
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && text.trim()) {
							void upsert({ text: text.trim() });
							setText("");
						}
					}}
				/>
				<Button
					variant="secondary"
					leadingIcon={<IconPlus size={14} />}
					disabled={!text.trim()}
					onClick={() => {
						void upsert({ text: text.trim() });
						setText("");
					}}
				>
					Add
				</Button>
			</div>
		</SectionCard>
	);
}
