import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "../cn";

export interface SelectItem {
	value: string;
	label: string;
	description?: string;
	disabled?: boolean;
}

export interface SelectGroup {
	label?: string;
	items: SelectItem[];
}

export interface SelectProps {
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	groups: SelectGroup[];
	size?: "sm" | "md";
	"aria-label"?: string;
}

const sizeClasses = {
	sm: "h-8 text-sm",
	md: "h-9 text-md",
};

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
	(
		{ value, onValueChange, placeholder = "Select an option", groups, size = "md", "aria-label": ariaLabel, ...props },
		ref,
	) => {
		const selectedItem = groups.flatMap((g) => g.items).find((item) => item.value === value);

		return (
			<SelectPrimitive.Root value={value} onValueChange={onValueChange}>
				<SelectPrimitive.Trigger
					ref={ref}
					aria-label={ariaLabel}
					className={cn(
						"flex items-center justify-between gap-2 px-3 py-2 rounded-md",
						"bg-sunken border border-border-subtle",
						"hover:border-border-strong focus-visible:border-accent",
						"text-fg disabled:opacity-50 disabled:cursor-not-allowed",
						"transition-colors",
						sizeClasses[size],
					)}
					{...props}
				>
					<SelectPrimitive.Value placeholder={placeholder} className="flex-1 text-left">
						{selectedItem?.label || placeholder}
					</SelectPrimitive.Value>
					<SelectPrimitive.Icon className="flex-shrink-0">
						<ChevronDown size={16} />
					</SelectPrimitive.Icon>
				</SelectPrimitive.Trigger>

				<SelectPrimitive.Portal>
					<SelectPrimitive.Content
						className={cn(
							"z-popover bg-elevated rounded-lg shadow-md overflow-hidden",
							"min-w-[var(--radix-select-trigger-width)]",
						)}
						position="popper"
					>
						<SelectPrimitive.Viewport className="p-1">
							{groups.map((group, groupIndex) => (
								<div key={group.label || groupIndex}>
									{group.label && <div className="px-2 py-1.5 text-xs font-medium text-fg-3">{group.label}</div>}
									{group.items.map((item) => (
										<SelectPrimitive.Item
											key={item.value}
											value={item.value}
											disabled={item.disabled}
											className={cn(
												"h-8 px-2 rounded-sm cursor-pointer",
												"flex flex-col justify-center",
												"text-sm data-[highlighted]:bg-hover",
												"text-fg data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
												"transition-colors",
											)}
										>
											<SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
											{item.description && <div className="text-xs text-fg-3 mt-0.5">{item.description}</div>}
										</SelectPrimitive.Item>
									))}
								</div>
							))}
						</SelectPrimitive.Viewport>
					</SelectPrimitive.Content>
				</SelectPrimitive.Portal>
			</SelectPrimitive.Root>
		);
	},
);

Select.displayName = "Select";
