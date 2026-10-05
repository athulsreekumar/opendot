import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "../cn";

const badgeVariants = cva("inline-flex items-center justify-center rounded-sm font-medium", {
	variants: {
		variant: {
			unread: "min-w-5 h-5 rounded-full bg-accent text-accent-fg text-2xs font-semibold px-1.5",
			muted: "h-5 px-2 rounded-sm bg-active text-fg-2 text-2xs font-medium",
			success: "h-5 px-1.5 rounded-sm bg-success-subtle text-success text-2xs font-medium",
			warning: "h-5 px-1.5 rounded-sm bg-warning-subtle text-warning text-2xs font-medium",
			danger: "h-5 px-1.5 rounded-sm bg-danger-subtle text-danger text-2xs font-medium",
			info: "h-5 px-1.5 rounded-sm bg-info-subtle text-info text-2xs font-medium",
			outline: "h-5 px-1.5 rounded-sm border border-border text-fg text-2xs font-medium",
		},
	},
	defaultVariants: {
		variant: "muted",
	},
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
	count?: number;
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
	({ className, variant, count, children, ...props }, ref) => {
		const displayValue = variant === "unread" && count ? (count > 99 ? "99+" : count) : children;

		return (
			<div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
				{displayValue}
			</div>
		);
	},
);

Badge.displayName = "Badge";
