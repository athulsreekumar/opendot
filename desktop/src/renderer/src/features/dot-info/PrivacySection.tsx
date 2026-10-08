import type { Dot, PiiMode } from "@shared/types";
import { Badge, SegmentedControl } from "@/design-system/components";
import { useSettings } from "@/stores/settings";
import { SectionCard } from "./ui";
import { useDotSaver } from "./useDotSaver";

const EXPLAIN: Record<PiiMode, string> = {
	auto: "Hide personal details when this Dot uses a cloud model. Nothing is hidden for models on your own device.",
	always: "Always hide personal details before anything leaves the app, even for local models.",
	off: "Never hide personal details for this Dot. Only choose this if you trust the model provider.",
};

export function PrivacySection({ dot }: { dot: Dot }) {
	const { save, saved } = useDotSaver(dot.id);
	const models = useSettings((s) => s.models);
	const defaultModel = useSettings((s) => s.settings?.defaultModel);
	const ref = dot.model ?? defaultModel;
	const model = ref && models.find((m) => m.providerId === ref.providerId && m.modelId === ref.modelId);

	return (
		<SectionCard title="Privacy" saved={saved} testId="section-privacy">
			<SegmentedControl
				aria-label="Personal details"
				value={dot.piiMode}
				options={[
					{ value: "auto", label: "Auto (recommended)" },
					{ value: "always", label: "Always" },
					{ value: "off", label: "Off" },
				]}
				onValueChange={(v) => save({ piiMode: v as PiiMode })}
			/>
			<p className="text-sm text-fg-2">{EXPLAIN[dot.piiMode]}</p>
			{model && (
				<p className="flex items-center gap-2 text-sm text-fg-2">
					Right now this Dot uses {model.label} ({model.providerLabel}).
					<Badge variant={model.isLocal ? "success" : "muted"}>{model.isLocal ? "On your device" : "Cloud"}</Badge>
				</p>
			)}
		</SectionCard>
	);
}
