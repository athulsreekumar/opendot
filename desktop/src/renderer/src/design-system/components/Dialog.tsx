import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../cn";

export interface DialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	title: React.ReactNode;
	description?: React.ReactNode;
	size?: "sm" | "md" | "lg";
	children: React.ReactNode;
	footer?: React.ReactNode;
	hideClose?: boolean;
}

const sizeClasses = {
	sm: "w-[400px]",
	md: "w-[520px]",
	lg: "w-[720px]",
};

export const Dialog = React.forwardRef<HTMLDivElement, DialogProps & React.ComponentPropsWithoutRef<"div">>(
	({ open, onOpenChange, title, description, size = "md", children, footer, hideClose, ...props }, ref) => (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 bg-overlay z-modal" />
				<DialogPrimitive.Content
					ref={ref}
					className={cn(
						"fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
						"bg-elevated rounded-xl shadow-lg z-modal",
						"max-h-[85vh] flex flex-col",
						sizeClasses[size],
					)}
					{...props}
				>
					{/* Header */}
					<div className="border-b border-border-subtle px-6 py-4 flex items-start justify-between">
						<div className="flex-1">
							<DialogPrimitive.Title className="text-xl font-semibold text-fg">{title}</DialogPrimitive.Title>
							{description && (
								<DialogPrimitive.Description className="text-sm text-fg-2 mt-1">
									{description}
								</DialogPrimitive.Description>
							)}
						</div>
						{!hideClose && (
							<button
								type="button"
								onClick={() => onOpenChange?.(false)}
								aria-label="Close"
								className="ml-4 p-1.5 hover:bg-hover rounded-md transition-colors flex-shrink-0"
							>
								<X size={16} className="text-fg-2" />
							</button>
						)}
					</div>

					{/* Body */}
					<div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

					{/* Footer */}
					{footer && <div className="border-t border-border-subtle px-6 py-4">{footer}</div>}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	),
);

Dialog.displayName = "Dialog";

export const DialogFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
	<div className={cn("flex items-center justify-end gap-2", className)}>{children}</div>
);

DialogFooter.displayName = "DialogFooter";
