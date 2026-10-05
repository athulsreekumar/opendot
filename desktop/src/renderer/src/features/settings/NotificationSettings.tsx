import { Switch, toast } from "@/design-system/components";
import { errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { Card } from "./parts";

export function NotificationSettings() {
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	if (!settings) return null;
	const n = settings.notifications;
	const set = (patch: Partial<typeof n>) =>
		update({ notifications: { ...n, ...patch } }).catch((e) =>
			toast({ title: "Couldn't save", description: errorText(e), variant: "error" }),
		);
	return (
		<Card>
			<Switch
				label="Show notifications"
				description="Get a desktop notification when a Dot replies while OpenDot is in the background."
				checked={n.enabled}
				onCheckedChange={(v) => set({ enabled: v })}
			/>
			<Switch label="Play a sound" checked={n.sound} disabled={!n.enabled} onCheckedChange={(v) => set({ sound: v })} />
			<Switch
				label="Show message preview"
				description="Turn this off to keep message text out of notifications."
				checked={n.showPreview}
				disabled={!n.enabled}
				onCheckedChange={(v) => set({ showPreview: v })}
			/>
		</Card>
	);
}
