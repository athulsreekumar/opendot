import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { type AnchorHTMLAttributes, type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

type Common = {
	/** primary = accent pill; secondary = Apple-style text link with a › chevron; ghost = outlined pill. */
	variant?: "primary" | "secondary" | "ghost";
	/** md = 44px min height, lg = 52px. */
	size?: "md" | "lg";
	children?: ReactNode;
};
type AsLink = Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof Common>;
type AsButton = Common & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Common>;
export type ButtonProps = AsLink | AsButton;

const base =
	"group/btn relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium " +
	"transition-[transform,background-color,box-shadow,color,opacity] duration-200 ease-out-expo " +
	"disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants = {
	primary:
		"rounded-full bg-accent text-accent-fg focus-visible:rounded-full hover:-translate-y-px hover:bg-accent-hover " +
		"hover:shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--accent)_70%,transparent)] active:translate-y-0 active:scale-[0.98]",
	ghost:
		"rounded-full border border-line text-fg focus-visible:rounded-full hover:-translate-y-px " +
		"hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] active:translate-y-0 active:scale-[0.98]",
	secondary: "rounded-md text-accent focus-visible:rounded-md hover:text-accent-hover active:scale-[0.98]",
} as const;

const sizes = {
	primary: { md: "min-h-11 px-6 text-[15px]", lg: "min-h-[52px] px-8 text-[17px]" },
	ghost: { md: "min-h-11 px-6 text-[15px]", lg: "min-h-[52px] px-8 text-[17px]" },
	secondary: { md: "min-h-11 px-1 text-[15px]", lg: "min-h-[52px] px-1 text-[17px]" },
} as const;

/**
 * Pill button / link. Renders <a> when `href` is given, otherwise <button type="button">.
 * `<Button variant="primary" size="lg" href="#signup">Get early access</Button>`
 */
export const Button = forwardRef<HTMLAnchorElement | HTMLButtonElement, ButtonProps>(function Button(props, ref) {
	const { variant = "primary", size = "md", className, children, ...rest } = props;
	const cls = clsx(base, variants[variant], sizes[variant][size], className);
	const content = (
		<>
			{children}
			{variant === "secondary" && (
				<ChevronRight
					aria-hidden="true"
					size={size === "lg" ? 20 : 17}
					strokeWidth={2.25}
					className="-mr-0.5 transition-transform duration-200 ease-out-expo group-hover/btn:translate-x-[3px]"
				/>
			)}
		</>
	);
	if ("href" in rest && rest.href !== undefined) {
		return (
			<a
				ref={ref as React.Ref<HTMLAnchorElement>}
				className={cls}
				{...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
			>
				{content}
			</a>
		);
	}
	const { type = "button", ...btn } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
	return (
		<button ref={ref as React.Ref<HTMLButtonElement>} type={type} className={cls} {...btn}>
			{content}
		</button>
	);
});
