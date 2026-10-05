import { useMemo, useState } from "react";
import { cn } from "@/design-system/cn";
import { Input } from "@/design-system/components";
import { IconSearch } from "@/design-system/icons";
import { EMOJI_DATA } from "./emoji-data";

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
	const [q, setQ] = useState("");
	const list = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return needle ? EMOJI_DATA.filter(([, kw]) => kw.includes(needle)) : EMOJI_DATA;
	}, [q]);
	return (
		<div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-sunken p-2">
			<Input
				aria-label="Search emoji"
				placeholder="Search emoji"
				leading={<IconSearch size={14} />}
				value={q}
				onChange={(e) => setQ(e.target.value)}
			/>
			<div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto" role="listbox" aria-label="Emoji">
				{list.map(([emoji, kw]) => (
					<button
						key={emoji}
						type="button"
						role="option"
						aria-selected={emoji === value}
						title={kw}
						onClick={() => onChange(emoji)}
						className={cn("h-8 rounded-md text-xl hover:bg-hover", emoji === value && "bg-selected ring-2 ring-accent")}
					>
						{emoji}
					</button>
				))}
				{list.length === 0 && <p className="col-span-8 py-2 text-center text-sm text-fg-3">No emoji found</p>}
			</div>
		</div>
	);
}
