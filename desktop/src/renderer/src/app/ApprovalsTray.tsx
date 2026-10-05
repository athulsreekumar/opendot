import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ApprovalRequest } from "@shared/types";
import { Avatar, Button } from "@/design-system/components";
import { IconApprove } from "@/design-system/icons";
import { relativeTime } from "@/lib/format";
import { useApprovals } from "@/stores/approvals";
import { useDots } from "@/stores/dots";
import { navigate } from "./router";

function ApprovalRow({ item }: { item: ApprovalRequest }) {
	const dot = useDots((s) => s.dots.find((d) => d.id === item.dotId));
	const respond = useApprovals((s) => s.respond);
	return (
		<li className="rounded-lg transition-colors hover:bg-hover">
			{/* biome-ignore lint/a11y/useSemanticElements: row contains no nested interactive content */}
			<div
				role="button"
				tabIndex={0}
				onClick={() => navigate(`#/chats/${item.dotId}`)}
				onKeyDown={(e) => {
					if (e.key === "Enter") navigate(`#/chats/${item.dotId}`);
				}}
				className="flex cursor-pointer gap-3 px-3 pt-3"
			>
				<Avatar
					size="sm"
					name={dot?.name ?? "Dot"}
					emoji={dot?.appearance.emoji}
					color={dot?.appearance.color ?? "teal"}
					mark={dot?.kind === "super"}
				/>
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline justify-between gap-2">
						<span className="truncate text-sm font-semibold text-fg">{item.title}</span>
						<span className="shrink-0 text-xs text-fg-3">{relativeTime(item.createdAt)}</span>
					</div>
					<p className="line-clamp-2 text-xs text-fg-2">{item.detail}</p>
					<p className="mt-0.5 truncate text-2xs text-fg-3">{dot?.name ?? "Unknown Dot"}</p>
				</div>
			</div>
			<div className="flex justify-end gap-2 px-3 pb-3 pt-2">
				<Button size="sm" variant="ghost" onClick={() => void respond(item.id, "deny")}>
					Deny
				</Button>
				<Button size="sm" variant="secondary" onClick={() => void respond(item.id, "allow-once")}>
					Allow once
				</Button>
			</div>
		</li>
	);
}

export function ApprovalsTray() {
	const pending = useApprovals((s) => s.pending);
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				side="right"
				align="end"
				sideOffset={12}
				className="z-popover w-[360px] overflow-hidden rounded-xl border border-border-subtle bg-elevated shadow-lg"
			>
				<div className="border-b border-border-subtle px-4 py-3 text-md font-semibold text-fg">Approvals</div>
				{pending.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
						<IconApprove size={24} className="text-fg-3" />
						<p className="text-sm text-fg-2">Nothing waiting for you.</p>
					</div>
				) : (
					<ul className="max-h-[420px] overflow-y-auto p-1">
						{pending.map((p) => (
							<ApprovalRow key={p.id} item={p} />
						))}
					</ul>
				)}
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	);
}
