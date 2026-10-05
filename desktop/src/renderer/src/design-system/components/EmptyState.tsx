import * as React from "react";
import { cn } from "../cn";

export interface EmptyStateProps {
	icon: React.ReactNode;
	title: string;
	body?: string;
	action?: {
		label: string;
		onClick: () => void;
	};
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(({ icon, title, body, action }, ref) => (
	<div ref={ref} className="flex flex-col items-center justify-center gap-4">
		{/* Icon container */}
		<div className="w-[72px] h-[72px] rounded-lg bg-accent-subtle flex items-center justify-center flex-shrink-0">
			<div className="w-10 h-10 flex items-center justify-center text-accent">{icon}</div>
		</div>

		{/* Content */}
		<div className="text-center">
			<h3 className="text-xl font-semibold text-fg">{title}</h3>
			{body && <p className="text-md text-fg-2 mt-2 max-w-[360px]">{body}</p>}
		</div>

		{/* Action */}
		{action && (
			<button
				type="button"
				onClick={action.onClick}
				className={cn(
					"h-9 px-4 rounded-md font-medium text-sm",
					"bg-accent text-accent-fg hover:bg-accent-hover",
					"transition-colors mt-2",
				)}
			>
				{action.label}
			</button>
		)}
	</div>
));

EmptyState.displayName = "EmptyState";
