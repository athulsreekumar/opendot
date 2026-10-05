import type { DotColor } from "@shared/types";
import { cva, type VariantProps } from "class-variance-authority";
import { type CSSProperties, forwardRef } from "react";
import { cn } from "../cn";
import { dotColorVars } from "../dot-colors";

const avatarVariants = cva("relative inline-flex items-center justify-center rounded-full font-semibold", {
	variants: {
		size: {
			xs: "h-6 w-6 text-xs",
			sm: "h-8 w-8 text-sm",
			md: "h-10 w-10 text-md",
			lg: "h-12 w-12 text-lg",
			xl: "h-24 w-24 text-4xl",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

const sizeMap = {
	xs: 24,
	sm: 32,
	md: 40,
	lg: 48,
	xl: 96,
};

const statusSizeMap = {
	xs: 8,
	sm: 10,
	md: 10,
	lg: 12,
	xl: 18,
};

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
	emoji?: string;
	color: DotColor;
	status?: "online" | "busy" | "away" | "error";
	ring?: boolean;
	name: string;
	mark?: boolean;
	className?: string;
}

const BrandMark = ({ size }: { size: number }) => {
	const dotSize = Math.round(size * 0.15);
	const radius = Math.round(size * 0.25);
	const offsetY = Math.round(size * 0.15);

	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
			{/* Three dots in an arc */}
			<circle cx={size / 2 - radius} cy={size / 2 - offsetY} r={dotSize / 2} fill="currentColor" />
			<circle cx={size / 2} cy={size / 2 - radius} r={dotSize / 2} fill="currentColor" />
			<circle cx={size / 2 + radius} cy={size / 2 - offsetY} r={dotSize / 2} fill="currentColor" />
		</svg>
	);
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
	({ size = "md", emoji, color, status, ring, name, mark, className }, ref) => {
		const sizeValue = size || "md";
		const pixelSize = sizeMap[sizeValue];
		const statusSize = statusSizeMap[sizeValue];
		const colorVars = dotColorVars(color);

		const statusColorMap = {
			online: "bg-success",
			busy: "bg-accent animate-pulse",
			away: "text-fg-3",
			error: "bg-danger",
		};

		return (
			<div
				ref={ref}
				className={cn(
					avatarVariants({ size }),
					ring && `ring-2 ring-[var(--dot)]`,
					"bg-[var(--dot-soft)] text-[var(--dot)] transition-colors",
					className,
				)}
				style={colorVars as CSSProperties}
				role="img"
				aria-label={name}
			>
				{mark ? <BrandMark size={Math.round(pixelSize * 0.6)} /> : emoji && <span>{emoji}</span>}

				{status && (
					<div
						className={cn("absolute bottom-0 right-0 rounded-full border-2 border-sidebar", statusColorMap[status])}
						style={{
							width: statusSize,
							height: statusSize,
						}}
					/>
				)}
			</div>
		);
	},
);

Avatar.displayName = "Avatar";
