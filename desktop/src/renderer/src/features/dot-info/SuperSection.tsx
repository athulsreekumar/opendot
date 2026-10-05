import type { Dot } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Switch, toast } from "@/design-system/components";
import { IconRefresh } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { Field, SectionCard } from "./ui";

type Entry = Awaited<ReturnType<typeof api.superbot.directory>>[number];

export function SuperSection() {
	const dots = useDots((s) => s.dots);
	const [directory, setDirectory] = useState<Entry[]>([]);
	const [busy, setBusy] = useState(false);
	const standard = dots.filter((d) => d.kind === "standard" && !d.archived);

	const load = useCallback(async () => {
		try {
			setDirectory(await api.superbot.directory());
		} catch {
			// not ready yet
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const refresh = async () => {
		setBusy(true);
		try {
			await api.superbot.refreshProfiles();
			await load();
			toast({ title: "Knowledge refreshed", variant: "success" });
		} catch (e) {
			toast({ title: "Couldn't refresh", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<SectionCard
			title="Directory and visibility"
			description="What SuperDot knows about your other Dots, and which ones it may ask."
			testId="section-super"
			right={
				<Button
					size="sm"
					variant="secondary"
					loading={busy}
					leadingIcon={<IconRefresh size={14} />}
					onClick={() => void refresh()}
				>
					Refresh knowledge
				</Button>
			}
		>
			<Field label="Directory">
				{directory.length === 0 ? (
					<p className="text-sm text-fg-3">Nothing yet. Create some Dots, then refresh.</p>
				) : (
					<ul className="flex flex-col gap-2">
						{directory.map((d) => (
							<li key={d.dotId} className="rounded-md bg-sunken p-3">
								<div className="text-sm font-medium text-fg">{d.name}</div>
								<p className="od-selectable whitespace-pre-wrap text-xs text-fg-2">{d.card}</p>
							</li>
						))}
					</ul>
				)}
			</Field>
			<Field label="Visibility">
				<ul className="flex flex-col gap-1.5">
					{standard.map((d: Dot) => (
						<li key={d.id} className="flex items-center justify-between gap-3 rounded-md bg-sunken px-3 py-2">
							<span className="flex min-w-0 items-center gap-2 text-sm text-fg">
								<Avatar size="xs" name={d.name} emoji={d.appearance.emoji} color={d.appearance.color} />
								<span className="truncate">{d.name}</span>
							</span>
							<span className="flex items-center gap-2 text-xs text-fg-2">
								SuperDot can ask
								<Switch
									aria-label={`SuperDot can ask ${d.name}`}
									checked={!d.hiddenFromSuper}
									onCheckedChange={(on) =>
										void useDots
											.getState()
											.update(d.id, { hiddenFromSuper: !on })
											.catch((e) => toast({ title: "Couldn't update", description: errorText(e), variant: "error" }))
									}
								/>
							</span>
						</li>
					))}
					{standard.length === 0 && <p className="text-sm text-fg-3">No other Dots yet.</p>}
				</ul>
			</Field>
		</SectionCard>
	);
}
