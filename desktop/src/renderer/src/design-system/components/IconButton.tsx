import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ReactNode } from "react";
import { cn } from "../cn";
import { Tooltip, TooltipProvider } from "./Tooltip";

const iconButtonVariants = cva(
	"inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
	{
		variants: {
			variant: {
				ghost: "text-fg hover:bg-hover active:bg-active",
				secondary: "bg-elevated border border-border text-fg hover:bg-hover active:bg-active",
				accent: "bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-pressed",
			},
			size: {
				sm: "h-7 w-7",
				md: "h-8 w-8",
				lg: "h-9 w-9",
			},
		},
		defaultVariants: {
			variant: "ghost",
			size: "md",
		},
	},
);

export interface IconButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof iconButtonVariants> {
	label: string;
	icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	({ className, variant, size = "md", label, icon, ...props }, ref) => {
		const button = (
			<button className={cn(iconButtonVariants({ variant, size }), className)} ref={ref} aria-label={label} {...props}>
				{icon}
			</button>
		);

		return (
			<TooltipProvider delayDuration={0}>
				<Tooltip content={label} side="bottom">
					{button}
				</Tooltip>
			</TooltipProvider>
		);
	},
);

IconButton.displayName = "IconButton";
