import type { ApprovalRequest } from "@shared/types";
import { useState } from "react";
import { Button } from "../../design-system/components";
import { IconWarning } from "../../design-system/icons";
import { useApprovals } from "../../stores/approvals";

/** A compact approval prompt for the quick-ask bar. The full card with details lives in the main window. */
export function QuickApproval({ approval }: { approval: ApprovalRequest }) {
	const [busy, setBusy] = useState(false);
	const respond = (decision: "allow-once" | "deny") => {
		setBusy(true);
		void useApprovals
			.getState()
			.respond(approval.id, decision)
			.catch(() => setBusy(false));
	};
	return (
		<div role="alertdialog" aria-label="Needs your approval" className="flex items-center gap-2 px-4 py-2">
			<IconWarning size={16} className="shrink-0 text-warning" />
			<div className="min-w-0 flex-1">
				<div className="text-sm font-medium text-fg">Needs your approval</div>
				<div className="truncate text-xs text-fg-2">{approval.title}</div>
			</div>
			<Button size="sm" disabled={busy} onClick={() => respond("allow-once")}>
				Allow once
			</Button>
			<Button size="sm" variant="ghost" className="text-danger" disabled={busy} onClick={() => respond("deny")}>
				Deny
			</Button>
		</div>
	);
}
