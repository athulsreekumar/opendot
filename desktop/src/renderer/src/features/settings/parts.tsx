import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/design-system/cn";
import { Input } from "@/design-system/components";

export function Section({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("flex flex-col gap-3", className)}>
			<div>
				<h2 className="text-lg font-semibold text-fg">{title}</h2>
				{description && <p className="text-sm text-fg-2 mt-0.5">{description}</p>}
			</div>
			{children}
		</section>
	);
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className={cn("rounded-lg border border-border-subtle bg-elevated p-4 flex flex-col gap-3", className)}>
			{children}
		</div>
	);
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps the control passed as children */}
			<label className="flex flex-col gap-1.5">
				<span className="text-sm font-medium text-fg">{label}</span>
				{children}
			</label>
			{hint && <p className="text-xs text-fg-3">{hint}</p>}
		</div>
	);
}

/** Number input that commits on blur / Enter. */
export function NumberField({
	label,
	value,
	min,
	max,
	step,
	hint,
	onCommit,
}: {
	label: string;
	value: number;
	min?: number;
	max?: number;
	step?: number;
	hint?: ReactNode;
	onCommit: (n: number) => void;
}) {
	const [text, setText] = useState(String(value));
	useEffect(() => setText(String(value)), [value]);
	const commit = () => {
		let n = Number(text);
		if (!Number.isFinite(n) || text.trim() === "") {
			setText(String(value));
			return;
		}
		if (min !== undefined) n = Math.max(min, n);
		if (max !== undefined) n = Math.min(max, n);
		setText(String(n));
		if (n !== value) onCommit(n);
	};
	return (
		<Field label={label} hint={hint}>
			<Input
				type="number"
				className="max-w-[160px]"
				value={text}
				min={min}
				max={max}
				step={step}
				onChange={(e) => setText(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") commit();
				}}
			/>
		</Field>
	);
}
