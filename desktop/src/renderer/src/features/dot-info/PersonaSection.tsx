import type { Dot } from "@shared/types";
import { useState } from "react";
import { Button, Dialog, Spinner, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { PersonaEditor } from "./editors";
import { Field, SectionCard } from "./ui";
import { useDotSaver } from "./useDotSaver";

export function PersonaSection({ dot }: { dot: Dot }) {
	const { save, savePersona, saved } = useDotSaver(dot.id);
	const [prompt, setPrompt] = useState<string>();
	const [loading, setLoading] = useState(false);
	const [confirmReset, setConfirmReset] = useState(false);
	const [regenerating, setRegenerating] = useState(false);

	const regenerate = async () => {
		if (!dot.creationPrompt) return;
		setRegenerating(true);
		try {
			const draft = await api.dots.draftFromDescription({ prompt: dot.creationPrompt, connectors: [] });
			save({ persona: draft.persona }, { applies: true });
			toast({ title: "New personality generated", variant: "success" });
		} catch (e) {
			toast({ title: "Couldn't regenerate", description: errorText(e), variant: "error" });
		} finally {
			setRegenerating(false);
		}
	};

	const preview = async () => {
		setLoading(true);
		setPrompt("");
		try {
			setPrompt(await api.dots.compiledPrompt(dot.id));
		} catch (e) {
			setPrompt(undefined);
			toast({ title: "Couldn't build the prompt", description: errorText(e), variant: "error" });
		} finally {
			setLoading(false);
		}
	};

	const reset = async () => {
		setConfirmReset(false);
		try {
			const t = (await api.dots.templates()).find((x) => x.id === dot.templateId);
			if (!t) {
				toast({ title: "No template to reset to", variant: "warning" });
				return;
			}
			save({ persona: t.draft.persona }, { applies: true });
		} catch (e) {
			toast({ title: "Couldn't reset", description: errorText(e), variant: "error" });
		}
	};

	return (
		<SectionCard
			title="Personality"
			saved={saved}
			testId="section-persona"
			right={
				<Button size="sm" variant="secondary" onClick={() => void preview()}>
					Preview prompt
				</Button>
			}
		>
			<PersonaEditor persona={dot.persona} full onChange={savePersona} />
			{dot.creationPrompt && (
				<Field label="How this Dot was described">
					<p className="od-selectable whitespace-pre-wrap rounded-md bg-sunken p-3 text-sm text-fg-2">
						{dot.creationPrompt}
					</p>
					<Button size="sm" variant="ghost" loading={regenerating} onClick={() => void regenerate()}>
						Regenerate personality from description
					</Button>
				</Field>
			)}
			{dot.templateId && (
				<div>
					<Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
						Reset to template
					</Button>
				</div>
			)}

			<Dialog
				open={prompt !== undefined}
				onOpenChange={(o) => !o && setPrompt(undefined)}
				size="lg"
				title="Compiled prompt"
				description="What this Dot is told before every conversation. Read-only."
			>
				{loading ? (
					<Spinner />
				) : (
					<pre className="od-selectable whitespace-pre-wrap break-words font-mono text-xs text-fg">{prompt}</pre>
				)}
			</Dialog>
			<Dialog
				open={confirmReset}
				onOpenChange={setConfirmReset}
				size="sm"
				title="Reset personality?"
				description="This replaces the personality with the template's original."
				footer={
					<div className="flex justify-end gap-2">
						<Button variant="ghost" onClick={() => setConfirmReset(false)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={() => void reset()}>
							Reset
						</Button>
					</div>
				}
			>
				<p className="text-sm text-fg-2">Your edits to the role, rules and sliders will be lost.</p>
			</Dialog>
		</SectionCard>
	);
}
