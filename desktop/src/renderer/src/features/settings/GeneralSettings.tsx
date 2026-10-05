import { DOT_COLORS, type ThemeMode } from "@shared/types";
import { cn } from "@/design-system/cn";
import { SegmentedControl, Switch, toast } from "@/design-system/components";
import { dotColorVars } from "@/design-system/dot-colors";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { Card, Section } from "./parts";

export function GeneralSettings() {
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	if (!settings) return null;
	const fail = (title: string) => (e: unknown) => toast({ title, description: errorText(e), variant: "error" });

	return (
		<div className="flex flex-col gap-8">
			<Section title="Appearance">
				<Card>
					<div className="flex items-center justify-between gap-4">
						<span className="text-md text-fg">Theme</span>
						<SegmentedControl
							aria-label="Theme"
							value={settings.theme}
							onValueChange={(v) => update({ theme: v as ThemeMode }).catch(fail("Couldn't change theme"))}
							options={[
								{ value: "system", label: "System" },
								{ value: "light", label: "Light" },
								{ value: "dark", label: "Dark" },
							]}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-md text-fg">Accent colour</span>
						<div className="flex flex-wrap gap-2">
							{DOT_COLORS.map((c) => (
								<button
									key={c}
									type="button"
									aria-pressed={settings.accent === c}
									aria-label={c}
									title={c}
									style={dotColorVars(c)}
									onClick={() => update({ accent: c }).catch(fail("Couldn't change accent"))}
									className={cn(
										"h-7 w-7 rounded-full bg-[var(--dot)] transition-transform hover:scale-110",
										settings.accent === c && "ring-2 ring-offset-2 ring-[var(--dot)]",
									)}
								/>
							))}
						</div>
					</div>
				</Card>
			</Section>
			<Section title="Startup">
				<Card>
					<Switch
						label="Open OpenDot when I log in"
						description="Starts quietly so your Dots can keep working."
						checked={settings.background.launchAtLogin}
						onCheckedChange={(on) => {
							api.app
								.setLaunchAtLogin(on)
								.then(() => update({ background: { ...settings.background, launchAtLogin: on } }))
								.catch(fail("Couldn't change launch at login"));
						}}
					/>
					<div className="flex items-center justify-between text-sm text-fg-3">
						<span>Language</span>
						<span>English (more soon)</span>
					</div>
				</Card>
			</Section>
		</div>
	);
}
