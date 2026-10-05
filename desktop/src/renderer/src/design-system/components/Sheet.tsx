import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "../cn";

export interface SheetProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	title: React.ReactNode;
	children: React.ReactNode;
	modal?: boolean;
}

export const Sheet = React.forwardRef<HTMLDivElement, SheetProps & React.ComponentPropsWithoutRef<"div">>(
	({ open, onOpenChange, title, children, modal = true, ...props }, ref) => (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			{modal && (
				<DialogPrimitive.Portal>
					<DialogPrimitive.Overlay className="fixed inset-0 bg-overlay z-modal" />
				</DialogPrimitive.Portal>
			)}
			{!modal && (
				<DialogPrimitive.Portal>{/* Overlay only for modal=false to not block interaction */}</DialogPrimitive.Portal>
			)}
			<DialogPrimitive.Content
				ref={ref}
				className={cn(
					"fixed right-0 top-0 bottom-0",
					"w-[var(--od-drawer-w)] h-[calc(100vh-var(--od-titlebar-h))] mt-[var(--od-titlebar-h)]",
					"bg-sidebar border-l border-border-subtle z-drawer",
					"flex flex-col",
				)}
				{...props}
			>
				{/* Header */}
				<div className="border-b border-border-subtle px-6 py-4 flex-shrink-0">
					<DialogPrimitive.Title className="text-xl font-semibold text-fg">{title}</DialogPrimitive.Title>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
			</DialogPrimitive.Content>
		</DialogPrimitive.Root>
	),
);

Sheet.displayName = "Sheet";
