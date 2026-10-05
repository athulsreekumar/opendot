export function DaySeparator({ label }: { label: string }) {
	return (
		<div className="sticky top-1 z-sticky flex justify-center py-2">
			<span className="inline-flex h-6 items-center rounded-full bg-elevated/90 px-2.5 text-xs font-medium text-fg-2 shadow-xs backdrop-blur">
				{label}
			</span>
		</div>
	);
}
