import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
			<DialogPrimitive.Portal>
				{/* The overlay only exists for modal sheets, so a non-modal one doesn't block the page. */}
				{modal && <DialogPrimitive.Overlay className="fixed inset-0 bg-overlay z-modal" />}
				<DialogPrimitive.Content
					ref={ref}
					className={cn(
						"fixed right-0 top-0 bottom-0",
						"w-[var(--od-drawer-w)] h-[calc(100vh-var(--od-titlebar-h))] mt-[var(--od-titlebar-h)]",
						"bg-sidebar border-l border-border-subtle",
						// Above its own overlay, or the overlay would swallow every click inside the sheet.
						modal ? "z-modal" : "z-drawer",
						"flex flex-col",
					)}
					{...props}
				>
					{/* Header */}
					<div className="border-b border-border-subtle px-6 py-4 flex-shrink-0 flex items-start justify-between">
						<DialogPrimitive.Title className="text-xl font-semibold text-fg">{title}</DialogPrimitive.Title>
						<button
							type="button"
							onClick={() => onOpenChange?.(false)}
							aria-label="Close"
							className="ml-4 p-1.5 hover:bg-hover rounded-md transition-colors flex-shrink-0"
						>
							<X size={16} className="text-fg-2" />
						</button>
					</div>

					{/* Body */}
					<div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	),
);

Sheet.displayName = "Sheet";
