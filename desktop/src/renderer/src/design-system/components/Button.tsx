import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ReactNode } from "react";
import { cn } from "../cn";
import { Spinner } from "./Spinner";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-[6px] rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
	{
		variants: {
			variant: {
				primary: "bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-pressed",
				secondary: "bg-elevated border border-border text-fg hover:bg-hover active:bg-active",
				ghost: "text-fg hover:bg-hover active:bg-active",
				danger: "bg-danger text-fg-inverse hover:opacity-90 active:opacity-75",
				link: "text-link no-underline hover:underline",
			},
			size: {
				sm: "h-7 px-2.5 text-sm",
				md: "h-8 px-3 text-md",
				lg: "h-10 px-4 text-lg",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
	},
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	loading?: boolean;
	leadingIcon?: ReactNode;
	trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, loading = false, leadingIcon, trailingIcon, disabled, children, ...props }, ref) => (
		<button
			className={cn(buttonVariants({ variant, size }), className)}
			disabled={disabled || loading}
			ref={ref}
			{...props}
			aria-busy={loading}
		>
			{loading ? <Spinner size={size === "sm" ? 16 : size === "lg" ? 24 : 20} /> : leadingIcon}
			{children}
			{trailingIcon}
		</button>
	),
);

Button.displayName = "Button";
