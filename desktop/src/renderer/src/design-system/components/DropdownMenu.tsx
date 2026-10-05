import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";
import { cn } from "../cn";

export interface MenuItemProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
	icon?: React.ReactNode;
	shortcut?: string;
	destructive?: boolean;
	onSelect?: () => void;
}

export const Menu = DropdownMenuPrimitive.Root;
export const MenuTrigger = DropdownMenuPrimitive.Trigger;

export const MenuContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			ref={ref}
			className={cn("z-popover bg-elevated rounded-lg shadow-md p-1", "min-w-[200px]", className)}
			{...props}
		/>
	</DropdownMenuPrimitive.Portal>
));

MenuContent.displayName = "MenuContent";

export const MenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Item>, MenuItemProps>(
	({ icon, shortcut, destructive, onSelect, children, className, ...props }, ref) => (
		<DropdownMenuPrimitive.Item
			ref={ref}
			onSelect={onSelect}
			className={cn(
				"h-8 px-2 rounded-sm cursor-pointer",
				"flex items-center justify-between gap-2",
				"text-sm data-[highlighted]:bg-hover",
				destructive ? "text-danger" : "text-fg",
				"transition-colors",
				className,
			)}
			{...props}
		>
			<div className="flex items-center gap-2">
				{icon && <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>}
				<span>{children}</span>
			</div>
			{shortcut && <span className="text-fg-3 text-xs ml-auto">{shortcut}</span>}
		</DropdownMenuPrimitive.Item>
	),
);

MenuItem.displayName = "MenuItem";

export const MenuSeparator = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.Separator ref={ref} className={cn("h-px bg-border-subtle my-1", className)} {...props} />
));

MenuSeparator.displayName = "MenuSeparator";
