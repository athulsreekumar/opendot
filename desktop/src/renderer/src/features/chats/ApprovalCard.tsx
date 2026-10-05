import type { ApprovalDecision, ApprovalRequest, DotId } from "@shared/types";
import { useEffect, useState } from "react";
import { Button, Tooltip, TooltipProvider, toast } from "../../design-system/components";
import { IconCheck, IconClose } from "../../design-system/icons";
import { errorText } from "../../lib/api";
import { useApprovals } from "../../stores/approvals";

function useCountdown(expiresAt: string): number {
	const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
	useEffect(() => {
		const t = setInterval(
			() => setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))),
			1000,
		);
		return () => clearInterval(t);
	}, [expiresAt]);
	return left;
}

function fmt(s: number): string {
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ApprovalCard({
	approval,
	onResolved,
}: {
	approval: ApprovalRequest;
	onResolved?: (d: ApprovalDecision) => void;
}) {
	const [details, setDetails] = useState(false);
	const [busy, setBusy] = useState(false);
	const left = useCountdown(approval.expiresAt);
	const respond = async (d: ApprovalDecision) => {
		setBusy(true);
		onResolved?.(d);
		try {
			await useApprovals.getState().respond(approval.id, d);
		} catch (e) {
			toast({ title: "Couldn't send your answer", description: errorText(e), variant: "error" });
		}
	};
	return (
		<div
			role="alertdialog"
			aria-label={approval.title}
			className="relative overflow-hidden rounded-lg border border-warning bg-elevated p-3 pl-4 shadow-sm"
		>
			<span className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
			<div className="text-md font-semibold text-fg">{approval.title}</div>
			{approval.detail && <div className="mt-0.5 text-sm text-fg-2">{approval.detail}</div>}
			{approval.args !== undefined && (
				<div className="mt-1">
					<button
						type="button"
						onClick={() => setDetails((o) => !o)}
						aria-expanded={details}
						className="text-xs text-fg-3 hover:text-fg-2"
					>
						{details ? "Hide details" : "Details"}
					</button>
					{details && (
						<pre className="od-selectable mt-1 max-h-40 overflow-auto rounded-md bg-sunken p-2 font-mono text-xs text-fg-2">
							{JSON.stringify(approval.args, null, 2)}
						</pre>
					)}
				</div>
			)}
			<div className="mt-2.5 flex items-center gap-2">
				<Button size="sm" disabled={busy || left === 0} onClick={() => void respond("allow-once")}>
					Allow once
				</Button>
				<TooltipProvider>
					<Tooltip content="For this Dot and this tool">
						<Button
							size="sm"
							variant="secondary"
							disabled={busy || left === 0}
							onClick={() => void respond("allow-always")}
						>
							Always allow
						</Button>
					</Tooltip>
				</TooltipProvider>
				<Button size="sm" variant="ghost" className="text-danger" disabled={busy} onClick={() => void respond("deny")}>
					Deny
				</Button>
				<span className="ml-auto text-2xs text-fg-3">{left > 0 ? `Expires in ${fmt(left)}` : "Expired"}</span>
			</div>
		</div>
	);
}

/** Pending approvals for one Dot, sticky above the composer; resolved ones shrink to a chip for a moment. */
export function ApprovalStack({ dotId }: { dotId: DotId }) {
	const pending = useApprovals((s) => s.pending);
	const mine = pending.filter((p) => p.dotId === dotId);
	const [resolved, setResolved] = useState<Array<{ id: string; allowed: boolean }>>([]);
	if (mine.length === 0 && resolved.length === 0) return null;
	const mark = (id: string, d: ApprovalDecision) => {
		setResolved((r) => [...r, { id, allowed: d !== "deny" }]);
		setTimeout(() => setResolved((r) => r.filter((x) => x.id !== id)), 2500);
	};
	return (
		<div className="z-sticky flex flex-col gap-2 border-t border-border-subtle bg-chat px-6 py-2">
			<div className="mx-auto flex w-full max-w-[var(--od-chat-max-w)] flex-col gap-2">
				{mine.map((a) => (
					<ApprovalCard key={a.id} approval={a} onResolved={(d) => mark(a.id, d)} />
				))}
				{resolved.map((r) => (
					<div
						key={r.id}
						className="inline-flex h-7 w-fit items-center gap-1 rounded-full bg-sunken px-2.5 text-xs text-fg-2"
					>
						{r.allowed ? (
							<IconCheck size={12} className="text-success" />
						) : (
							<IconClose size={12} className="text-danger" />
						)}
						{r.allowed ? "Allowed" : "Denied"}
					</div>
				))}
			</div>
		</div>
	);
}
