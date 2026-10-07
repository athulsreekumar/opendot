import { resolveBriefing } from "@shared/defaults";
import type { BriefingStatus, BriefingSettings as Cfg } from "@shared/types";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { navigate } from "@/app/router";
import { Button, Input, SegmentedControl, Switch, TextArea, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { useSettings } from "@/stores/settings";
import { Card, Field, Section } from "./parts";

function statusLine(st: BriefingStatus | undefined, enabled: boolean): string {
	if (!enabled) return "Off. Nothing is prepared until you turn it on.";
	const next = st?.nextRunAt ? format(new Date(st.nextRunAt), "EEE d MMM, HH:mm") : undefined;
	return next ? `Next briefing: ${next}.` : "Choose a time to get your first briefing.";
}

export function BriefingSettings() {
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	const superId = useDots((s) => s.dots.find((d) => d.kind === "super")?.id);
	const [status, setStatus] = useState<BriefingStatus>();
	const [running, setRunning] = useState(false);
	const cfg = resolveBriefing(settings);
	const [instructions, setInstructions] = useState(cfg.instructions);
	const [time, setTime] = useState(cfg.time);
	useEffect(() => setInstructions(cfg.instructions), [cfg.instructions]);
	useEffect(() => setTime(cfg.time), [cfg.time]);

	const refresh = useCallback(() => {
		api.briefing
			.status()
			.then(setStatus)
			.catch(() => undefined);
	}, []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: refetch the schedule when the settings change
	useEffect(refresh, [refresh, cfg.enabled, cfg.time, cfg.days, JSON.stringify(cfg.dots)]);

	if (!settings) return null;
	const fail = (e: unknown) => toast({ title: "Couldn't save", description: errorText(e), variant: "error" });
	const set = (patch: Partial<Cfg>) => update({ briefing: { ...cfg, ...patch } }).catch(fail);

	const runNow = async () => {
		setRunning(true);
		try {
			const r = await api.briefing.run();
			if (r.started && superId) navigate(`#/chats/${superId}`);
			else if (r.started) toast({ title: "Preparing your briefing", variant: "success" });
			else toast({ title: "Briefing not started", description: r.reason, variant: "info" });
		} catch (e) {
			toast({ title: "Couldn't run the briefing", description: errorText(e), variant: "error" });
		} finally {
			setRunning(false);
			refresh();
		}
	};

	return (
		<div className="flex flex-col gap-8" data-testid="briefing-settings">
			<Section
				title="Daily briefing"
				description="Once a day SuperDot asks your Dots what matters, then sends you one briefing and one notification."
			>
				<Card>
					<Switch
						label="Send me a daily briefing"
						description={statusLine(status, cfg.enabled)}
						checked={cfg.enabled}
						onCheckedChange={(enabled) => void set({ enabled })}
					/>
					<div className="flex flex-wrap items-end gap-6">
						<Field label="Time of day">
							<Input
								type="time"
								aria-label="Time of day"
								className="max-w-[140px]"
								value={time}
								onChange={(e) => setTime(e.target.value)}
								onBlur={() => {
									if (/^\d{2}:\d{2}$/.test(time) && time !== cfg.time) void set({ time });
									else setTime(cfg.time);
								}}
							/>
						</Field>
						<Field label="Days">
							<SegmentedControl
								aria-label="Days"
								value={cfg.days}
								onValueChange={(v) => void set({ days: v as Cfg["days"] })}
								options={[
									{ value: "weekdays", label: "Weekdays" },
									{ value: "daily", label: "Every day" },
								]}
							/>
						</Field>
					</div>
					<p className="text-xs text-fg-3">
						If your computer is asleep or OpenDot is closed at that time, the briefing runs when OpenDot next runs the
						same day before 18:00. It never runs twice in a day.
					</p>
				</Card>
			</Section>
			<Section
				title="Which Dots contribute"
				description="By default every Dot that has a connection a briefing can use, like a calendar or email. Untick any you want left out."
			>
				<Card>
					{(status?.candidates ?? []).length === 0 && (
						<p className="text-sm text-fg-3">No Dots yet. Create a Dot and connect Google or Microsoft first.</p>
					)}
					{(status?.candidates ?? []).map((c) => (
						<Switch
							key={c.dotId}
							aria-label={`Include ${c.name}`}
							label={c.name}
							description={c.relevant ? undefined : "No calendar, email or similar connection yet"}
							checked={c.included}
							onCheckedChange={(on) => void set({ dots: { ...cfg.dots, [c.dotId]: on } })}
						/>
					))}
				</Card>
			</Section>
			<Section
				title="Extra instructions"
				description="Optional. For example: keep it under 100 words, or mention travel first."
			>
				<Card>
					<TextArea
						aria-label="Extra instructions"
						rows={3}
						maxLength={1000}
						value={instructions}
						onChange={(e) => setInstructions(e.target.value)}
						onBlur={() => instructions !== cfg.instructions && void set({ instructions })}
					/>
				</Card>
			</Section>
			<Section title="Try it" description="Prepare today's briefing now. It appears in SuperDot's chat.">
				<Card>
					<div>
						<Button variant="secondary" loading={running} onClick={() => void runNow()}>
							Run briefing now
						</Button>
					</div>
				</Card>
			</Section>
		</div>
	);
}
