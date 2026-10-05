import type { ModelOption, ModelRef } from "@shared/types";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@/design-system/cn";
import type { SelectGroup } from "@/design-system/components";
import { IconCheck, IconChevronDown, IconChevronRight } from "@/design-system/icons";

/** A card with a header, used for every Dot Info section. */
export function SectionCard({
	title,
	description,
	saved,
	right,
	children,
	testId,
}: {
	title: string;
	description?: string;
	saved?: boolean;
	right?: ReactNode;
	children: ReactNode;
	testId?: string;
}) {
	return (
		<section className="rounded-lg border border-border-subtle bg-elevated" data-testid={testId}>
			<header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
				<div className="min-w-0">
					<h3 className="text-lg font-semibold text-fg">{title}</h3>
					{description && <p className="text-sm text-fg-2">{description}</p>}
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{saved && (
						<span className="inline-flex items-center gap-1 text-xs text-success" role="status">
							<IconCheck size={12} /> Saved
						</span>
					)}
					{right}
				</div>
			</header>
			<div className="flex flex-col gap-4 px-4 pb-4">{children}</div>
		</section>
	);
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	const id = useId();
	return (
		<fieldset className="flex min-w-0 flex-col gap-1.5" aria-labelledby={id}>
			<legend id={id} className="mb-1.5 p-0 text-sm font-medium text-fg">
				{label}
			</legend>
			{children}
			{hint && <p className="text-xs text-fg-3">{hint}</p>}
		</fieldset>
	);
}

export function Collapsible({
	title,
	defaultOpen = false,
	children,
}: {
	title: string;
	defaultOpen?: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div className="rounded-md border border-border-subtle">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				className="flex w-full items-center gap-1.5 px-3 h-9 text-sm font-medium text-fg hover:bg-hover rounded-md"
			>
				{open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
				{title}
			</button>
			{open && <div className="flex flex-col gap-3 px-3 pb-3">{children}</div>}
		</div>
	);
}

export const DEFAULT_MODEL_VALUE = "__default__";

export function modelValue(ref?: ModelRef): string {
	return ref ? `${ref.providerId}|${ref.modelId}` : DEFAULT_MODEL_VALUE;
}

export function parseModelValue(v: string): ModelRef | undefined {
	if (v === DEFAULT_MODEL_VALUE) return undefined;
	const i = v.indexOf("|");
	return { providerId: v.slice(0, i), modelId: v.slice(i + 1) };
}

export function defaultModelLabel(models: ModelOption[], def?: ModelRef): string {
	if (!def) return "none yet";
	return models.find((m) => m.providerId === def.providerId && m.modelId === def.modelId)?.label ?? def.modelId;
}

/** Select groups: "Default (<label>)" first, then models grouped by provider. */
export function modelGroups(models: ModelOption[], def?: ModelRef, current?: ModelRef): SelectGroup[] {
	const byProvider = new Map<string, ModelOption[]>();
	for (const m of models) byProvider.set(m.providerLabel, [...(byProvider.get(m.providerLabel) ?? []), m]);
	const groups: SelectGroup[] = [
		{ items: [{ value: DEFAULT_MODEL_VALUE, label: `Default (${defaultModelLabel(models, def)})` }] },
	];
	for (const [label, list] of byProvider) {
		groups.push({
			label,
			items: list.map((m) => ({
				value: modelValue(m),
				label: m.isLocal ? `${m.label} 🔒` : m.label,
			})),
		});
	}
	if (current && !models.some((m) => m.providerId === current.providerId && m.modelId === current.modelId)) {
		groups.push({
			label: "Unavailable",
			items: [{ value: modelValue(current), label: `${current.modelId} (missing)` }],
		});
	}
	return groups;
}

export function ListRow({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn("flex items-center gap-2 rounded-md bg-sunken px-3 py-2", className)}>{children}</div>;
}
