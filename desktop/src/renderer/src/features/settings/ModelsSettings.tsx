import { useState } from "react";
import { Button } from "@/design-system/components";
import { IconPlus } from "@/design-system/icons";
import { useSettings } from "@/stores/settings";
import { AddProviderDialog } from "./AddProviderDialog";
import { DefaultModelPicker } from "./DefaultModelPicker";
import { ProviderCard } from "./ProviderCard";
import { Section } from "./parts";

export function ModelsSettings() {
	const providers = useSettings((s) => s.providers);
	const [open, setOpen] = useState(false);
	const groups = [
		{ title: "Cloud", items: providers.filter((p) => p.kind === "cloud") },
		{ title: "On this computer", items: providers.filter((p) => p.kind === "self-hosted") },
		{ title: "Custom", items: providers.filter((p) => p.kind === "custom-url") },
	];
	return (
		<div className="flex flex-col gap-8">
			<Section title="Default model" description="Dots use this unless you pick a different model for them.">
				<DefaultModelPicker />
			</Section>
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold text-fg">Providers</h2>
				<Button leadingIcon={<IconPlus size={14} />} onClick={() => setOpen(true)}>
					Add provider
				</Button>
			</div>
			{providers.length === 0 && (
				<p className="text-sm text-fg-2">
					No providers yet. Add a cloud key or connect a model running on this computer.
				</p>
			)}
			{groups.map(
				(g) =>
					g.items.length > 0 && (
						<Section key={g.title} title={g.title}>
							<div className="flex flex-col gap-3">
								{g.items.map((p) => (
									<ProviderCard key={p.id} provider={p} />
								))}
							</div>
						</Section>
					),
			)}
			<AddProviderDialog open={open} onOpenChange={setOpen} />
		</div>
	);
}
