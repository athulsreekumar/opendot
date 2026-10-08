import type { Dot, ThinkingLevel } from "@shared/types";
import { useMemo } from "react";
import { Badge, SegmentedControl, Select } from "@/design-system/components";
import { useSettings } from "@/stores/settings";
import { Field, modelGroups, modelValue, parseModelValue, SectionCard } from "./ui";
import { useDotSaver } from "./useDotSaver";

const BASE_LEVELS: Array<{ value: ThinkingLevel; label: string }> = [
	{ value: "off", label: "Off" },
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
];

export function ModelSection({ dot }: { dot: Dot }) {
	const { save, saved } = useDotSaver(dot.id);
	const models = useSettings((s) => s.models);
	const defaultModel = useSettings((s) => s.settings?.defaultModel);
	const groups = useMemo(() => modelGroups(models, defaultModel, dot.model), [models, defaultModel, dot.model]);
	const selected =
		dot.model && models.find((m) => m.providerId === dot.model?.providerId && m.modelId === dot.model.modelId);
	const missing = Boolean(dot.model && !selected);
	const effective =
		selected ??
		(!dot.model
			? models.find((m) => m.providerId === defaultModel?.providerId && m.modelId === defaultModel?.modelId)
			: undefined);
	const levels = BASE_LEVELS.some((l) => l.value === dot.thinkingLevel)
		? BASE_LEVELS
		: [...BASE_LEVELS, { value: dot.thinkingLevel, label: dot.thinkingLevel }];

	return (
		<SectionCard title="Model" saved={saved} testId="section-model">
			<Field label="Model">
				<Select
					aria-label="Model"
					value={modelValue(dot.model)}
					groups={groups}
					onValueChange={(v) => {
						const ref = parseModelValue(v);
						save(ref ? { model: ref } : { clearModel: true });
					}}
				/>
				{effective && (
					<div className="flex items-center gap-2 text-xs text-fg-3">
						{effective.isLocal && <Badge variant="success">local</Badge>}
						{effective.contextWindow && <span>{Math.round(effective.contextWindow / 1000)}k context window</span>}
					</div>
				)}
				{missing && (
					<div
						className="flex items-center justify-between rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning"
						role="alert"
					>
						This model isn't available any more. Using the default instead.
					</div>
				)}
			</Field>
			<Field
				label="Thinking"
				hint={effective && !effective.reasoning ? "This model may ignore the thinking level." : undefined}
			>
				<SegmentedControl
					aria-label="Thinking level"
					value={dot.thinkingLevel}
					options={levels}
					onValueChange={(v) => save({ thinkingLevel: v as ThinkingLevel })}
				/>
			</Field>
		</SectionCard>
	);
}
