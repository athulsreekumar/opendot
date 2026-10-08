import { searchDotIcons } from "@shared/dot-icons";
import { useMemo, useState } from "react";
import { cn } from "@/design-system/cn";
import { Input } from "@/design-system/components";
import { DotIcon } from "@/design-system/dot-icon-map";
import { IconSearch } from "@/design-system/icons";

/** Grid of the curated Dot icons with search by name or keyword. */
export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
	const [q, setQ] = useState("");
	const list = useMemo(() => searchDotIcons(q), [q]);
	return (
		<div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-sunken p-2">
			<Input
				aria-label="Search icons"
				placeholder="Search icons"
				leading={<IconSearch size={14} />}
				value={q}
				onChange={(e) => setQ(e.target.value)}
			/>
			<div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto" role="listbox" aria-label="Icons">
				{list.map((icon) => (
					<button
						key={icon.key}
						type="button"
						role="option"
						aria-selected={icon.key === value}
						aria-label={icon.label}
						title={icon.label}
						onClick={() => onChange(icon.key)}
						className={cn(
							"inline-flex h-8 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg",
							icon.key === value && "bg-selected text-fg ring-2 ring-accent",
						)}
					>
						<DotIcon name={icon.key} size={18} />
					</button>
				))}
				{list.length === 0 && <p className="col-span-8 py-2 text-center text-sm text-fg-3">No icons found</p>}
			</div>
		</div>
	);
}
