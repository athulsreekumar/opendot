import * as React from "react";
import { cn } from "../cn";
import { Spinner } from "./Spinner";

export type StatusState =
	| "connected"
	| "connecting"
	| "needs-auth"
	| "error"
	| "disabled"
	| "disconnected"
	| "running"
	| "idle"
	| "paused"
	| "backoff"
	| "over-budget"
	| "off";

export interface StatusPillProps {
	state: StatusState;
	label?: string;
}

const statusConfig: Record<StatusState, { color: string; label: string; showSpinner?: boolean }> = {
	connected: { color: "text-success bg-success-subtle", label: "Connected" },
	connecting: {
		color: "text-info bg-info-subtle",
		label: "Connecting",
		showSpinner: true,
	},
	"needs-auth": {
		color: "text-warning bg-warning-subtle",
		label: "Needs auth",
	},
	error: { color: "text-danger bg-danger-subtle", label: "Error" },
	disabled: { color: "text-fg-3 bg-active", label: "Disabled" },
	disconnected: { color: "text-fg-3 bg-active", label: "Disconnected" },
	running: {
		color: "text-info bg-info-subtle",
		label: "Running",
		showSpinner: true,
	},
	idle: { color: "text-fg-3 bg-active", label: "Idle" },
	paused: { color: "text-warning bg-warning-subtle", label: "Paused" },
	backoff: {
		color: "text-warning bg-warning-subtle",
		label: "Backoff",
		showSpinner: true,
	},
	"over-budget": {
		color: "text-danger bg-danger-subtle",
		label: "Over budget",
	},
	off: { color: "text-fg-3 bg-active", label: "Off" },
};

export const StatusPill = React.forwardRef<HTMLDivElement, StatusPillProps>(({ state, label }, ref) => {
	const config = statusConfig[state];
	const displayLabel = label || config.label;

	return (
		<div
			ref={ref}
			className={cn("inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full", "text-xs font-medium", config.color)}
		>
			<span className="w-1.5 h-1.5 rounded-full bg-current" />
			{displayLabel}
			{config.showSpinner && <Spinner size={16} className="ml-1 -mr-1.5" />}
		</div>
	);
});

StatusPill.displayName = "StatusPill";
