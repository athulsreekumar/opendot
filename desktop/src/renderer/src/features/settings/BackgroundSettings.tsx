import { useState } from "react";
import { Switch, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { Card, NumberField, Section } from "./parts";

export function BackgroundSettings() {
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	const [busy, setBusy] = useState(false);
	if (!settings) return null;
	const bg = settings.background;
	const wh = settings.localWebhook;
	const fail = (e: unknown) => toast({ title: "Couldn't save", description: errorText(e), variant: "error" });
	const setBg = (patch: Partial<typeof bg>) => update({ background: { ...bg, ...patch } }).catch(fail);
	const setWh = (patch: Partial<typeof wh>) => update({ localWebhook: { ...wh, ...patch } }).catch(fail);

	return (
		<div className="flex flex-col gap-8">
			<Section title="Keep running" description="Dots that are always on need OpenDot to stay open in the menu bar.">
				<Card>
					<Switch
						label="Run in the background"
						description="Closing the window keeps your Dots working instead of quitting."
						checked={bg.runInBackground}
						onCheckedChange={(v) => setBg({ runInBackground: v })}
					/>
					<Switch
						label="Open OpenDot when I log in"
						checked={bg.launchAtLogin}
						onCheckedChange={(on) => {
							api.app
								.setLaunchAtLogin(on)
								.then(() => setBg({ launchAtLogin: on }))
								.catch(fail);
						}}
					/>
					<Switch
						label="Hide the Dock icon when the window is closed"
						checked={bg.hideDockWhenClosed}
						disabled={!bg.runInBackground}
						onCheckedChange={(v) => setBg({ hideDockWhenClosed: v })}
					/>
					<Switch
						label="Keep my Mac awake"
						description="Stops macOS from pausing OpenDot while it sleeps idle. This uses more battery, so leave it off unless Dots miss events when you're away."
						checked={bg.keepAwake}
						onCheckedChange={(v) => setBg({ keepAwake: v })}
					/>
				</Card>
			</Section>
			<Section title="Spending">
				<Card>
					<NumberField
						label="Daily spending cap across all Dots (USD)"
						min={0}
						step={0.5}
						hint="Dots stop working in the background once they reach this amount today. 0 means no cap."
						value={bg.maxCostUsdPerDay}
						onCommit={(n) => setBg({ maxCostUsdPerDay: n })}
					/>
				</Card>
			</Section>
			<Section title="Local webhook" description="Let other apps on this Mac send events to a Dot.">
				<Card>
					<Switch label="Enable local webhook" checked={wh.enabled} onCheckedChange={(v) => setWh({ enabled: v })} />
					<NumberField label="Port" min={1024} max={65535} value={wh.port} onCommit={(n) => setWh({ port: n })} />
					<div className="flex flex-col gap-1">
						<span className="text-sm text-fg-2">Example</span>
						<pre className="od-selectable rounded-md bg-sunken p-3 text-xs text-fg overflow-x-auto">
							{`curl -X POST http://127.0.0.1:${wh.port}/hook/<token> \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Build finished","body":"All green"}'`}
						</pre>
						<p className="text-xs text-fg-3">
							Each webhook watcher has its own token. Find it in the Dot's Always on settings.
						</p>
					</div>
				</Card>
			</Section>
			<Section title="Pause">
				<Card>
					<Switch
						label="Pause all Dots"
						description="Stops every Dot from reacting to events until you turn this off."
						checked={bg.paused}
						disabled={busy}
						onCheckedChange={(paused) => {
							setBusy(true);
							api.runtime
								.pauseAll(paused)
								.then(() => api.settings.get())
								.then((s) => useSettings.getState().set(s))
								.catch(fail)
								.finally(() => setBusy(false));
						}}
					/>
				</Card>
			</Section>
		</div>
	);
}
