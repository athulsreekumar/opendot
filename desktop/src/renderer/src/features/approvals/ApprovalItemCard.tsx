import { applyEdits, formatApprovalDetail } from "@shared/approvals/describe";
import type { ApprovalRequest, Dot } from "@shared/types";
import { useMemo, useState } from "react";
import { Avatar, Button, Input, Kbd, TextArea, toast } from "@/design-system/components";
import { errorText } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useApprovals } from "@/stores/approvals";
import { fmt, useCountdown } from "../chats/ApprovalCard";
import { ApprovalDetailView } from "./ApprovalDetailView";

type Mode = "view" | "edit" | "deny";

export function ApprovalItemCard({
	approval,
	dot,
	showDot,
	highlight,
}: {
	approval: ApprovalRequest;
	dot?: Dot;
	/** Show the Dot's avatar and name (hidden when the card sits under a Dot heading). */
	showDot: boolean;
	highlight?: boolean;
}) {
	const [mode, setMode] = useState<Mode>("view");
	const [busy, setBusy] = useState(false);
	const [reason, setReason] = useState("");
	const left = useCountdown(approval.expiresAt);
	const detail = useMemo(
		() => (approval.toolName ? formatApprovalDetail(approval.toolName, approval.args) : undefined),
		[approval.toolName, approval.args],
	);
	const fields = approval.kind === "tool" && detail ? detail.fields : [];
	const [values, setValues] = useState<Record<string, string>>(() =>
		Object.fromEntries(fields.map((f) => [f.key, f.value])),
	);
	const canAlways = approval.kind === "tool" && approval.alwaysAllowable !== false;
	const dotName = dot?.name ?? "A Dot";

	const send = async (
		decision: "allow-once" | "allow-always" | "deny",
		extras?: { reason?: string; editedArgs?: Record<string, unknown> },
	) => {
		if (busy) return;
		setBusy(true);
		try {
			await useApprovals.getState().respond(approval.id, decision, extras);
		} catch (e) {
			setBusy(false);
			toast({ title: "Couldn't send your answer", description: errorText(e), variant: "error" });
		}
	};

	const allowEdited = () => {
		const edited = applyEdits(approval.args, fields, values);
		const patch = Object.fromEntries(fields.map((f) => [f.key, edited[f.key]]));
		void send("allow-once", { editedArgs: patch });
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		const t = e.target as HTMLElement;
		if (t.closest("input, textarea, select, [contenteditable]")) {
			if (e.key === "Escape" && mode !== "view") {
				e.stopPropagation();
				setMode("view");
			}
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey || mode !== "view") return;
		const k = e.key.toLowerCase();
		if (k === "a") {
			e.preventDefault();
			void send("allow-once");
		} else if (k === "d") {
			e.preventDefault();
			void send("deny");
		} else if (k === "e" && fields.length > 0) {
			e.preventDefault();
			setMode("edit");
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a focusable card with its own keyboard shortcuts
		<div
			role="group"
			// biome-ignore lint/a11y/noNoninteractiveTabindex: the card takes focus so A, D and E work on it
			tabIndex={0}
			aria-label={approval.title}
			data-approval-id={approval.id}
			onKeyDown={onKeyDown}
			className={`relative overflow-hidden rounded-lg border bg-elevated p-4 pl-5 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${highlight ? "border-accent" : "border-border-subtle"}`}
		>
			<span className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
			<div className="flex items-start gap-3">
				{showDot && (
					<Avatar
						size="sm"
						name={dotName}
						emoji={dot?.appearance.emoji}
						color={dot?.appearance.color ?? "teal"}
						mark={dot?.kind === "super"}
					/>
				)}
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline justify-between gap-3">
						<h3 className="text-md font-semibold text-fg">{approval.title}</h3>
						<span className="shrink-0 text-2xs text-fg-3">
							{left > 0 ? `Expires in ${fmt(left)}` : "Expired"} · {relativeTime(approval.createdAt)}
						</span>
					</div>
					{approval.why ? (
						<p className="mt-1 whitespace-pre-wrap text-sm text-fg-2">
							<span className="text-fg-3">Why: </span>
							{approval.why}
						</p>
					) : (
						<p className="mt-1 text-sm text-fg-3">{dotName} did not say why.</p>
					)}
				</div>
			</div>

			<div className="mt-3">
				{mode === "edit" ? (
					<div className="flex flex-col gap-2">
						{fields.map((f) => (
							<div key={f.key} className="flex flex-col gap-1 text-xs text-fg-3">
								<span>{f.label}</span>
								{f.multiline ? (
									<TextArea
										aria-label={f.label}
										autoGrow
										minRows={3}
										maxRows={12}
										className="font-sans text-sm text-fg"
										value={values[f.key] ?? ""}
										onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
									/>
								) : (
									<Input
										aria-label={f.label}
										value={values[f.key] ?? ""}
										onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
									/>
								)}
							</div>
						))}
						{approval.toolName === "write" && (
							<p className="text-2xs text-fg-3">The file is written with your version.</p>
						)}
					</div>
				) : (
					<ApprovalDetailView approval={approval} />
				)}
			</div>

			{mode === "deny" && (
				<div className="mt-3 flex flex-col gap-2">
					<Input
						autoFocus
						aria-label="Reason for denying"
						placeholder="Tell the Dot why (optional)"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								void send("deny", { reason });
							}
						}}
					/>
				</div>
			)}

			<div className="mt-3 flex flex-wrap items-center gap-2">
				{mode === "view" && (
					<>
						<Button size="sm" disabled={busy || left === 0} onClick={() => void send("allow-once")}>
							Allow once <Kbd className="ml-1">A</Kbd>
						</Button>
						{fields.length > 0 && (
							<Button size="sm" variant="secondary" disabled={busy || left === 0} onClick={() => setMode("edit")}>
								Edit, then allow <Kbd className="ml-1">E</Kbd>
							</Button>
						)}
						{canAlways && (
							<Button
								size="sm"
								variant="secondary"
								title="Skips this question next time, for this tool and this Dot."
								disabled={busy || left === 0}
								onClick={() => void send("allow-always")}
							>
								Always allow for this Dot
							</Button>
						)}
						<Button size="sm" variant="ghost" className="text-danger" disabled={busy} onClick={() => void send("deny")}>
							Deny <Kbd className="ml-1">D</Kbd>
						</Button>
						<Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("deny")}>
							Deny with a reason
						</Button>
					</>
				)}
				{mode === "edit" && (
					<>
						<Button size="sm" disabled={busy || left === 0} onClick={allowEdited}>
							Allow with my changes
						</Button>
						<Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("view")}>
							Cancel
						</Button>
					</>
				)}
				{mode === "deny" && (
					<>
						<Button size="sm" variant="danger" disabled={busy} onClick={() => void send("deny", { reason })}>
							Deny
						</Button>
						<Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("view")}>
							Cancel
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
