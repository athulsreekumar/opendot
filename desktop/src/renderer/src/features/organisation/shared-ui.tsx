import { Button, EmptyState } from "@/design-system/components";
import { IconOrganisation } from "@/design-system/icons";

export function Unavailable({ onRetry, detail }: { onRetry: () => void; detail?: string | null }) {
	return (
		<div role="alert" className="flex flex-col items-center gap-4 px-6 py-20 text-center">
			<EmptyState
				icon={<IconOrganisation size={28} />}
				title="Organisation isn't available yet"
				body="OpenDot couldn't load your team just now. Try again in a moment."
			/>
			{detail ? <p className="max-w-[420px] text-xs text-fg-3">{detail}</p> : null}
			<Button variant="secondary" onClick={onRetry}>
				Retry
			</Button>
		</div>
	);
}

export function CheckRow({
	checked,
	onChange,
	children,
	disabled,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	children: React.ReactNode;
	disabled?: boolean;
}) {
	return (
		<label className="flex items-center gap-2 text-sm text-fg">
			<input
				type="checkbox"
				className="h-4 w-4 accent-accent"
				checked={checked}
				disabled={disabled}
				onChange={(e) => onChange(e.target.checked)}
			/>
			{children}
		</label>
	);
}

export function Callout({
	tone = "info",
	children,
	title,
}: {
	tone?: "info" | "warning" | "danger" | "success";
	title?: string;
	children?: React.ReactNode;
}) {
	const cls = {
		info: "bg-info-subtle text-info",
		warning: "bg-warning-subtle text-warning",
		danger: "bg-danger-subtle text-danger",
		success: "bg-success-subtle text-success",
	}[tone];
	return (
		<div role="status" className={`rounded-lg px-4 py-3 text-sm ${cls}`}>
			{title && <p className="font-medium">{title}</p>}
			{children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
		</div>
	);
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={htmlFor} className="text-sm font-medium text-fg">
				{label}
			</label>
			{children}
		</div>
	);
}
