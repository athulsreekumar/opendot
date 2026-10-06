import type { Dot } from "@shared/types";
import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
	Button,
	EmptyState,
	IconButton,
	Input,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	SegmentedControl,
} from "@/design-system/components";
import { IconChats, IconCheck, IconMore, IconNewDot, IconSearch } from "@/design-system/icons";
import { DotListItem } from "@/features/chats/DotListItem";
import { useDots } from "@/stores/dots";
import { useUi } from "@/stores/ui";

type Filter = "all" | "unread" | "pinned";

export function filterDots(dots: Dot[], opts: { query: string; filter: Filter; showArchived: boolean }): Dot[] {
	const q = opts.query.trim().toLowerCase();
	return dots.filter((d) => {
		if (d.archived && !opts.showArchived) return false;
		if (opts.filter === "unread" && d.unreadCount === 0) return false;
		if (opts.filter === "pinned" && !d.pinned && d.kind !== "super") return false;
		if (q && !`${d.name} ${d.tagline} ${d.lastMessagePreview}`.toLowerCase().includes(q)) return false;
		return true;
	});
}

export function ListPane({ selectedId }: { selectedId?: string }) {
	const dots = useDots((s) => s.dots);
	const setNewDotOpen = useUi((s) => s.setNewDotOpen);
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [showArchived, setShowArchived] = useState(false);

	const visible = useMemo(() => filterDots(dots, { query, filter, showArchived }), [dots, query, filter, showArchived]);
	const hasAny = dots.length > 0;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="od-drag h-[var(--od-titlebar-h)] shrink-0" />
			<header className="flex h-[60px] shrink-0 items-center justify-between px-4 -mt-2 in-data-[platform=win32]:mt-0">
				<h1 className="text-2xl font-semibold text-fg">Chats</h1>
				<div className="od-no-drag flex items-center gap-1">
					<IconButton
						label="New Dot"
						onClick={() => setNewDotOpen(true)}
						icon={<IconNewDot size={18} strokeWidth={1.75} />}
					/>
					<Menu>
						<MenuTrigger asChild>
							<IconButton label="More" icon={<IconMore size={18} strokeWidth={1.75} />} />
						</MenuTrigger>
						<MenuContent align="end">
							<MenuItem
								icon={showArchived ? <IconCheck size={16} /> : undefined}
								onSelect={() => setShowArchived((v) => !v)}
							>
								Show archived
							</MenuItem>
						</MenuContent>
					</Menu>
				</div>
			</header>
			<div className="od-no-drag flex shrink-0 flex-col gap-3 px-4 pb-3">
				<Input
					id="dot-search"
					aria-label="Search Dots"
					placeholder="Search Dots"
					className="rounded-full"
					leading={<IconSearch size={16} />}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setQuery("");
							e.currentTarget.blur();
						}
					}}
				/>
				<SegmentedControl
					size="sm"
					aria-label="Filter Dots"
					value={filter}
					onValueChange={(v) => setFilter(v as Filter)}
					options={[
						{ value: "all", label: "All" },
						{ value: "unread", label: "Unread" },
						{ value: "pinned", label: "Pinned" },
					]}
				/>
			</div>
			<div className="min-h-0 flex-1 pb-2">
				{visible.length > 0 ? (
					<Virtuoso
						data={visible}
						computeItemKey={(_, d) => d.id}
						initialItemCount={Math.min(visible.length, 20)}
						itemContent={(_, d) => <DotListItem dot={d} selected={d.id === selectedId} />}
					/>
				) : !hasAny ? (
					<div className="flex h-full items-center justify-center px-6">
						<EmptyState
							icon={<IconChats size={32} />}
							title="No Dots yet"
							body="Each Dot is an assistant with its own skills and personality."
							action={{ label: "Create your first Dot", onClick: () => setNewDotOpen(true) }}
						/>
					</div>
				) : (
					<div className="flex h-full flex-col items-center gap-3 px-6 pt-16 text-center">
						<p className="text-md text-fg-2">
							{query.trim()
								? `No Dots match “${query.trim()}”`
								: filter === "unread"
									? "No unread Dots"
									: filter === "pinned"
										? "No pinned Dots"
										: "Nothing to show"}
						</p>
						{(query || filter !== "all") && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setQuery("");
									setFilter("all");
								}}
							>
								Clear filters
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
