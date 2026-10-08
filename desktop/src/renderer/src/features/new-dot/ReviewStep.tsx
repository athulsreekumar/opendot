import type { ConnectorChoice, DotDraft, SuggestedWatcher } from "@shared/types";
import { useMemo, useState } from "react";
import { navigate } from "@/app/router";
import { Avatar, Badge, Button, Input, Select, Switch, toast } from "@/design-system/components";
import { DotIcon } from "@/design-system/dot-icon-map";
import { IconCheck } from "@/design-system/icons";
import { PersonaEditor } from "@/features/dot-info/editors";
import { Field, modelGroups, modelValue, parseModelValue } from "@/features/dot-info/ui";
import { errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { useSettings } from "@/stores/settings";
import { ColorSwatches } from "./ColorSwatches";
import { IconPicker } from "./IconPicker";

export function ReviewStep({
	draft: initial,
	prompt,
	connectors,
	onBack,
	onCreated,
}: {
	draft: DotDraft;
	prompt: string;
	connectors: ConnectorChoice[];
	onBack: () => void;
	onCreated: () => void;
}) {
	const [draft, setDraft] = useState<DotDraft>(initial);
	const [alwaysOn, setAlwaysOn] = useState(Boolean(initial.alwaysOn?.enabled));
	const suggested = initial.suggestedWatchers ?? [];
	const [watcherOn, setWatcherOn] = useState<boolean[]>(() => suggested.map(() => true));
	const [iconOpen, setIconOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const models = useSettings((s) => s.models);
	const defaultModel = useSettings((s) => s.settings?.defaultModel);
	const groups = useMemo(() => modelGroups(models, defaultModel, draft.model), [models, defaultModel, draft.model]);

	const patch = (p: Partial<DotDraft>) => setDraft((d) => ({ ...d, ...p }));
	const nameOk = draft.name.trim().length >= 1 && draft.name.trim().length <= 32;

	const create = async () => {
		if (!nameOk || busy) return;
		setBusy(true);
		try {
			const watchers: SuggestedWatcher[] = alwaysOn ? suggested.filter((_, i) => watcherOn[i]) : [];
			const dot = await useDots.getState().create({
				draft: {
					...draft,
					name: draft.name.trim(),
					suggestedConnections: connectors.map((c) => c.id),
					alwaysOn: { ...draft.alwaysOn, enabled: alwaysOn },
				},
				creationPrompt: prompt,
				connectors,
				watchers,
			});
			onCreated();
			navigate(`#/chats/${dot.id}`);
			toast({ title: `${dot.name} is ready`, description: "Say hi to get started.", variant: "success" });
		} catch (e) {
			toast({ title: "Couldn't create the Dot", description: errorText(e), variant: "error" });
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-[240px_1fr] gap-6">
				<aside className="flex flex-col gap-3" aria-label="Preview">
					<div className="flex h-[72px] items-center gap-3 rounded-lg bg-selected px-3">
						<Avatar
							size="md"
							name={draft.name || "New Dot"}
							icon={draft.appearance.icon}
							color={draft.appearance.color}
						/>
						<div className="min-w-0 flex-1">
							<div className="truncate text-lg font-semibold text-fg">{draft.name || "Name"}</div>
							<div className="truncate text-sm text-fg-2">{draft.tagline || "Tagline"}</div>
						</div>
					</div>
					<div className="od-chat-wallpaper rounded-lg p-3">
						<div className="max-w-full rounded-bubble bg-bubble-in px-2.5 py-2 text-md text-fg shadow-bubble od-selectable">
							{draft.persona.greeting || "Hi!"}
						</div>
					</div>
				</aside>

				<div className="flex min-w-0 flex-col gap-4">
					<Field label="Name">
						<Input
							aria-label="Name"
							value={draft.name}
							maxLength={32}
							invalid={!nameOk}
							onChange={(e) => patch({ name: e.target.value })}
						/>
					</Field>

					<Field label="Icon">
						<div>
							<Button variant="secondary" aria-expanded={iconOpen} onClick={() => setIconOpen(!iconOpen)}>
								<DotIcon name={draft.appearance.icon} size={18} /> Change icon
							</Button>
						</div>
						{iconOpen && (
							<IconPicker
								value={draft.appearance.icon}
								onChange={(icon) => {
									patch({ appearance: { ...draft.appearance, icon } });
									setIconOpen(false);
								}}
							/>
						)}
					</Field>

					<ColorSwatches
						value={draft.appearance.color}
						onChange={(color) => patch({ appearance: { ...draft.appearance, color } })}
					/>

					<Field label="Tagline">
						<Input
							aria-label="Tagline"
							value={draft.tagline}
							maxLength={60}
							onChange={(e) => patch({ tagline: e.target.value })}
						/>
					</Field>

					<PersonaEditor
						persona={draft.persona}
						collapsibleRules
						onChange={(p) => patch({ persona: { ...draft.persona, ...p } })}
					/>

					<Field label="Connectors">
						{connectors.length === 0 ? (
							<p className="text-sm text-fg-3">None chosen. You can add tools later in Dot Info.</p>
						) : (
							<ul className="flex flex-col gap-1">
								{connectors.map((c) => (
									<li
										key={c.id}
										className="flex items-center justify-between rounded-md bg-sunken px-3 py-1.5 text-sm text-fg"
									>
										{c.label}
										{c.kind === "installed" ? (
											<Badge variant="success">
												<IconCheck size={12} /> Installed
											</Badge>
										) : (
											<Badge variant="muted">Set up after creating</Badge>
										)}
									</li>
								))}
							</ul>
						)}
					</Field>

					<div className="flex flex-col gap-2">
						<Switch
							label="Always on"
							description="Keep working in the background and tell you when something needs you."
							checked={alwaysOn}
							onCheckedChange={setAlwaysOn}
						/>
						{alwaysOn && suggested.length > 0 && (
							<ul className="flex flex-col gap-1 pl-10">
								{suggested.map((w, i) => (
									<li key={`${w.type}-${w.label}`}>
										<label className="flex items-center gap-2 text-sm text-fg">
											<input
												type="checkbox"
												className="accent-[var(--od-accent)]"
												checked={watcherOn[i] ?? false}
												onChange={(e) => setWatcherOn((a) => a.map((v, j) => (j === i ? e.target.checked : v)))}
											/>
											{w.label}
										</label>
									</li>
								))}
							</ul>
						)}
					</div>

					<Field label="Model">
						<Select
							aria-label="Model"
							value={modelValue(draft.model)}
							groups={groups}
							onValueChange={(v) => patch({ model: parseModelValue(v) })}
						/>
					</Field>
				</div>
			</div>

			<div className="flex items-center justify-between border-t border-border-subtle pt-4">
				<Button variant="ghost" onClick={onBack} disabled={busy}>
					Back
				</Button>
				<Button variant="primary" loading={busy} disabled={!nameOk} onClick={() => void create()}>
					Create Dot
				</Button>
			</div>
		</div>
	);
}
