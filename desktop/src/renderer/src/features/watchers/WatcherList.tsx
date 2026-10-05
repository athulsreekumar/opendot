import type { DotId, Watcher } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import {
	Button,
	Dialog,
	IconButton,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	StatusPill,
	toast,
} from "@/design-system/components";
import { IconMore, IconPlus } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { AddWatcherDialog } from "./AddWatcherDialog";
import { everyLabel, watcherIcon } from "./watcher-forms";

type TypeInfo = Awaited<ReturnType<typeof api.watchers.types>>[number];

export function WatcherList({ dotId, refreshKey }: { dotId: DotId; refreshKey?: number }) {
	const [items, setItems] = useState<Watcher[]>([]);
	const [types, setTypes] = useState<TypeInfo[]>([]);
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<Watcher>();
	const [deleting, setDeleting] = useState<Watcher>();

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an explicit reload trigger
	const reload = useCallback(() => {
		void api.watchers
			.list(dotId)
			.then(setItems)
			.catch(() => undefined);
	}, [dotId, refreshKey]);

	useEffect(() => {
		reload();
		void api.watchers
			.types()
			.then(setTypes)
			.catch(() => undefined);
		const off = api.on("watcher:changed", (w) => {
			if (w.dotId !== dotId) return;
			setItems((list) => (list.some((x) => x.id === w.id) ? list.map((x) => (x.id === w.id ? w : x)) : [...list, w]));
		});
		return off;
	}, [dotId, reload]);

	const act = async (fn: () => Promise<unknown>, okTitle?: string) => {
		try {
			await fn();
			if (okTitle) toast({ title: okTitle, variant: "success" });
		} catch (e) {
			toast({ title: "That didn't work", description: errorText(e), variant: "error" });
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-fg">Watchers</span>
				<Button size="sm" variant="secondary" leadingIcon={<IconPlus size={14} />} onClick={() => setAdding(true)}>
					Add watcher
				</Button>
			</div>
			{items.length === 0 ? (
				<p className="text-sm text-fg-3">
					No watchers yet. Add one so this Dot hears about new mail, files or changes.
				</p>
			) : (
				<ul className="flex flex-col gap-1.5">
					{items.map((w) => {
						const push = types.find((t) => t.type === w.type)?.push ?? false;
						return (
							<li key={w.id} className="flex items-center gap-3 rounded-md bg-sunken px-3 py-2">
								<span className="text-fg-2">{watcherIcon(w.type)}</span>
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-medium text-fg">{w.label}</div>
									<div className="truncate text-xs text-fg-3">
										{everyLabel(w, push)} · last event {relativeTime(w.lastEventAt)}
										{w.lastError ? ` · ${w.lastError}` : ""}
									</div>
								</div>
								<StatusPill state={w.enabled ? w.state : "paused"} />
								<Menu>
									<MenuTrigger asChild>
										<IconButton label={`Actions for ${w.label}`} size="sm" icon={<IconMore size={16} />} />
									</MenuTrigger>
									<MenuContent align="end">
										<MenuItem onSelect={() => void act(() => api.watchers.runNow(w.id), "Checking now")}>
											Run now
										</MenuItem>
										<MenuItem onSelect={() => setEditing(w)}>Edit</MenuItem>
										<MenuItem
											onSelect={() =>
												void act(async () => {
													const u = await api.watchers.update(w.id, { enabled: !w.enabled });
													setItems((l) => l.map((x) => (x.id === u.id ? u : x)));
												})
											}
										>
											{w.enabled ? "Pause" : "Resume"}
										</MenuItem>
										<MenuItem destructive onSelect={() => setDeleting(w)}>
											Delete
										</MenuItem>
									</MenuContent>
								</Menu>
							</li>
						);
					})}
				</ul>
			)}

			{adding && (
				<AddWatcherDialog open dotId={dotId} onOpenChange={(o) => !o && setAdding(false)} onSaved={() => reload()} />
			)}
			{editing && (
				<AddWatcherDialog
					open
					dotId={dotId}
					watcher={editing}
					onOpenChange={(o) => !o && setEditing(undefined)}
					onSaved={() => reload()}
				/>
			)}
			<Dialog
				open={Boolean(deleting)}
				onOpenChange={(o) => !o && setDeleting(undefined)}
				size="sm"
				title="Delete this watcher?"
				description={deleting ? `"${deleting.label}" will stop reporting to this Dot.` : undefined}
				footer={
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => setDeleting(undefined)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={() => {
								const w = deleting;
								setDeleting(undefined);
								if (w)
									void act(async () => {
										await api.watchers.remove(w.id);
										setItems((l) => l.filter((x) => x.id !== w.id));
									}, "Watcher deleted");
							}}
						>
							Delete
						</Button>
					</div>
				}
			>
				<p className="text-sm text-fg-2">This can't be undone.</p>
			</Dialog>
		</div>
	);
}
