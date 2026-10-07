import {
	acceleratorLabel,
	acceleratorWords,
	QUICK_ASK_PRESETS,
	type QuickAskStatus,
	resolveQuickAsk,
} from "@shared/quickask";
import { useEffect, useState } from "react";
import { Select, Switch, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { isMac } from "@/lib/platform";
import { useSettings } from "@/stores/settings";
import { Card, Field, Section } from "../settings/parts";

const platform = isMac ? "darwin" : "other";

export function QuickAskSettings() {
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	const [status, setStatus] = useState<QuickAskStatus | undefined>();
	const q = resolveQuickAsk(settings);

	// Main registers the hotkey as soon as settings change; ask it how that went.
	// biome-ignore lint/correctness/useExhaustiveDependencies: ask again whenever the setting changes
	useEffect(() => {
		let live = true;
		void api.quickAsk
			.status()
			.then((st) => live && setStatus(st))
			.catch(() => undefined);
		return () => {
			live = false;
		};
	}, [q.enabled, q.shortcut]);

	if (!settings) return null;
	const fail = (e: unknown) => toast({ title: "Couldn't save", description: errorText(e), variant: "error" });
	const set = (patch: Partial<typeof q>) => update({ quickAsk: { ...q, ...patch } }).catch(fail);

	return (
		<Section
			title="Global shortcut"
			description="Press a shortcut anywhere to ask SuperDot, or @ a Dot, without opening OpenDot. The answer lands in that chat too."
		>
			<Card>
				<Switch
					label="Turn on quick ask"
					description="OpenDot needs to be running. Turn on Run in the background to keep it available when the window is closed."
					checked={q.enabled}
					onCheckedChange={(enabled) => set({ enabled })}
				/>
				<Field label="Shortcut">
					<Select
						aria-label="Quick ask shortcut"
						value={q.shortcut}
						onValueChange={(shortcut) => set({ shortcut })}
						groups={[
							{
								items: QUICK_ASK_PRESETS.map((p) => ({ value: p, label: acceleratorWords(p, platform) })),
							},
						]}
					/>
				</Field>
				{q.enabled && status?.error && (
					<p role="alert" className="text-sm text-danger">
						{status.error} Pick a different shortcut.
					</p>
				)}
				{q.enabled && status?.registered && (
					<p className="text-xs text-fg-3">Try it: press {acceleratorLabel(q.shortcut, platform)} in any app.</p>
				)}
			</Card>
		</Section>
	);
}
