import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { navigate, type Route } from "@/app/router";
import { Avatar } from "@/design-system/components";
import { IconClose } from "@/design-system/icons";
import { useApprovals } from "@/stores/approvals";
import { useDots } from "@/stores/dots";
import { ApprovalCard } from "../chats/ApprovalCard";

/** Most cards shown at once; the rest are counted with a link to the inbox. */
const MAX_SHOWN = 2;

/**
 * New approvals pop up in the corner of whatever screen you are on, so a Dot that is waiting for you is never
 * missed. Hidden where they already show: the Approvals screen, and the open chat of the Dot that is asking.
 * Closing a card only hides it here; it stays in Approvals until answered.
 */
export function ApprovalPopup({ route }: { route: Route }) {
	const pending = useApprovals((s) => s.pending);
	const dots = useDots((s) => s.dots);
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

	if (route.name === "approvals") return null;
	const openChat = route.name === "chats" ? route.dotId : undefined;
	const waiting = pending.filter((a) => a.dotId !== openChat && !hidden.has(a.id)).reverse();
	const shown = waiting.slice(0, MAX_SHOWN);
	const more = waiting.length - shown.length;
	const hide = (id: string) => setHidden((h) => new Set(h).add(id));

	return (
		<section
			aria-label="Approvals waiting for you"
			className="pointer-events-none fixed right-4 top-[calc(var(--od-titlebar-h)+8px)] z-popover flex w-[min(400px,calc(100vw-2rem))] flex-col gap-2"
		>
			<AnimatePresence initial={false}>
				{shown.map((a) => {
					const dot = dots.find((d) => d.id === a.dotId);
					return (
						<motion.div
							key={a.id}
							layout
							initial={{ opacity: 0, x: 24 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 24 }}
							transition={{ duration: 0.18 }}
							className="pointer-events-auto rounded-lg bg-elevated shadow-lg"
						>
							<div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
								<Avatar
									size="xs"
									name={dot?.name ?? "Dot"}
									emoji={dot?.appearance.emoji}
									color={dot?.appearance.color ?? "teal"}
									mark={dot?.kind === "super"}
								/>
								<span className="min-w-0 flex-1 truncate text-xs text-fg-2">
									{dot?.name ?? "A Dot"} is waiting for you
								</span>
								<button
									type="button"
									className="text-xs text-link hover:underline"
									onClick={() => navigate(`#/approvals/${a.id}`)}
								>
									Review
								</button>
								<button
									type="button"
									aria-label="Hide"
									className="rounded-sm p-0.5 text-fg-3 hover:bg-sunken hover:text-fg-2"
									onClick={() => hide(a.id)}
								>
									<IconClose size={14} />
								</button>
							</div>
							<ApprovalCard approval={a} />
						</motion.div>
					);
				})}
			</AnimatePresence>
			{more > 0 && (
				<button
					type="button"
					className="pointer-events-auto self-end rounded-full bg-elevated px-3 py-1 text-xs text-fg-2 shadow-md hover:text-fg"
					onClick={() => navigate("#/approvals")}
				>
					{more} more waiting · Review all
				</button>
			)}
		</section>
	);
}
