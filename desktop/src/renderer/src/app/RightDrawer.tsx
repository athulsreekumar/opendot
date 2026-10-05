import type { DotId } from "@shared/types";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/design-system/cn";
import { IconButton, ScrollArea } from "@/design-system/components";
import { IconClose } from "@/design-system/icons";
import { DotInfoDrawer } from "@/features/dot-info/DotInfoDrawer";
import { useUi } from "@/stores/ui";

export function RightDrawer({ dotId, overlay = false }: { dotId: DotId; overlay?: boolean }) {
	const setDrawer = useUi((s) => s.setDrawer);
	const reduced = useReducedMotion();
	return (
		<motion.aside
			aria-label="Dot info"
			initial={reduced ? false : { x: "100%" }}
			animate={{ x: 0 }}
			exit={reduced ? { opacity: 0 } : { x: "100%" }}
			transition={{ duration: reduced ? 0 : 0.28, ease: [0.2, 0, 0, 1] }}
			className={cn(
				"flex h-full w-[var(--od-drawer-w)] shrink-0 flex-col border-l border-border-subtle bg-sidebar",
				overlay && "absolute bottom-0 right-0 top-0 z-drawer shadow-lg",
			)}
		>
			<header className="od-drag flex h-[60px] shrink-0 items-center justify-between border-b border-border-subtle px-4 pt-1">
				<h2 className="text-lg font-semibold text-fg">Dot info</h2>
				<IconButton
					className="od-no-drag"
					label="Close"
					onClick={() => setDrawer(false)}
					icon={<IconClose size={18} strokeWidth={1.75} />}
				/>
			</header>
			<div className="min-h-0 flex-1 [&>div]:h-full">
				<ScrollArea>
					<DotInfoDrawer dotId={dotId} />
				</ScrollArea>
			</div>
		</motion.aside>
	);
}
