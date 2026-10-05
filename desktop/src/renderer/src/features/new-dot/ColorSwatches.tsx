import type { DotColor } from "@shared/types";
import { DOT_COLORS } from "@shared/types";
import { cn } from "@/design-system/cn";
import { dotColorVars } from "@/design-system/dot-colors";
import { Field } from "@/features/dot-info/ui";

export function ColorSwatches({ value, onChange }: { value: DotColor; onChange: (c: DotColor) => void }) {
	return (
		<Field label="Colour">
			<div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
				{DOT_COLORS.map((c) => (
					// biome-ignore lint/a11y/useSemanticElements: styled swatch radio
					<button
						key={c}
						type="button"
						role="radio"
						aria-checked={c === value}
						aria-label={c}
						onClick={() => onChange(c)}
						style={dotColorVars(c)}
						className={cn(
							"h-6 w-6 rounded-full bg-[var(--dot)] transition-shadow",
							c === value && "ring-2 ring-offset-2 ring-[var(--dot)]",
						)}
					/>
				))}
			</div>
		</Field>
	);
}
