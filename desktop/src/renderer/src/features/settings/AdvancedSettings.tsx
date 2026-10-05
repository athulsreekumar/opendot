import { useState } from "react";
import { Button, Dialog, DialogFooter, Input, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { Card, NumberField, Section } from "./parts";

export function AdvancedSettings() {
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	const [resetOpen, setResetOpen] = useState(false);
	const [typed, setTyped] = useState("");
	const [resetting, setResetting] = useState(false);
	if (!settings) return null;
	const save = (patch: Parameters<typeof update>[0]) =>
		update(patch).catch((e) => toast({ title: "Couldn't save", description: errorText(e), variant: "error" }));

	const doReset = async () => {
		setResetting(true);
		try {
			await api.app.reset();
		} catch (e) {
			toast({ title: "Couldn't reset", description: errorText(e), variant: "error" });
			setResetting(false);
		}
	};

	return (
		<div className="flex flex-col gap-8">
			<Section title="Dot Links" description="Limits for Dots that talk to each other.">
				<Card>
					<NumberField
						label="Daily budget for Dot-to-Dot messages"
						min={0}
						value={settings.links.globalDailyBudget}
						onCommit={(n) => save({ links: { ...settings.links, globalDailyBudget: n } })}
					/>
					<NumberField
						label="Max hops"
						min={1}
						max={5}
						hint="How many Dots in a row can pass a request along."
						value={settings.links.maxDepth}
						onCommit={(n) => save({ links: { ...settings.links, maxDepth: n } })}
					/>
					<NumberField
						label="Reply timeout (seconds)"
						min={5}
						value={settings.links.replyTimeoutSec}
						onCommit={(n) => save({ links: { ...settings.links, replyTimeoutSec: n } })}
					/>
				</Card>
			</Section>
			<Section title="Performance">
				<Card>
					<NumberField
						label="Free up idle Dots after (minutes)"
						min={1}
						value={settings.runtime.idleDisposeMinutes}
						onCommit={(n) => save({ runtime: { ...settings.runtime, idleDisposeMinutes: n } })}
					/>
					<NumberField
						label="Max Dots working at once"
						min={1}
						max={16}
						value={settings.runtime.maxConcurrentRuns}
						onCommit={(n) => save({ runtime: { ...settings.runtime, maxConcurrentRuns: n } })}
					/>
				</Card>
			</Section>
			<Section title="Data">
				<Card>
					<div className="flex items-center justify-between gap-4">
						<span className="text-md text-fg">Everything lives in ~/.opendot</span>
						<Button variant="secondary" onClick={() => void api.app.revealDataDir()}>
							Open data folder
						</Button>
					</div>
				</Card>
				<Card className="border-danger">
					<div className="flex items-center justify-between gap-4">
						<div>
							<div className="text-md font-medium text-fg">Reset OpenDot</div>
							<p className="text-sm text-fg-2">Deletes all Dots, chats, keys and settings on this Mac.</p>
						</div>
						<Button
							variant="danger"
							onClick={() => {
								setTyped("");
								setResetOpen(true);
							}}
						>
							Reset OpenDot
						</Button>
					</div>
				</Card>
			</Section>
			<Dialog
				open={resetOpen}
				onOpenChange={setResetOpen}
				size="sm"
				title="Reset OpenDot?"
				description="This can't be undone. Type RESET to confirm."
				footer={
					<DialogFooter>
						<Button variant="ghost" onClick={() => setResetOpen(false)}>
							Cancel
						</Button>
						<Button variant="danger" disabled={typed !== "RESET"} loading={resetting} onClick={() => void doReset()}>
							Erase everything
						</Button>
					</DialogFooter>
				}
			>
				<Input
					aria-label="Type RESET to confirm"
					value={typed}
					onChange={(e) => setTyped(e.target.value)}
					placeholder="RESET"
				/>
			</Dialog>
		</div>
	);
}
