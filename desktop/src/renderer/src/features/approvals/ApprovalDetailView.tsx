import { type ApprovalDetail, formatApprovalDetail } from "@shared/approvals/describe";
import type { ApprovalRequest } from "@shared/types";
import { useMemo } from "react";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex gap-3 text-sm">
			<dt className="w-16 shrink-0 text-fg-3">{label}</dt>
			<dd className="od-selectable min-w-0 flex-1 break-words text-fg">{children}</dd>
		</div>
	);
}

function Code({ children }: { children: string }) {
	return (
		<pre className="od-selectable max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-sunken p-2 font-mono text-xs text-fg-2">
			{children}
		</pre>
	);
}

const FILE_VERBS = { write: "Write to", edit: "Change", read: "Read", delete: "Delete" } as const;

export function DetailBody({ detail }: { detail: ApprovalDetail }) {
	switch (detail.kind) {
		case "email":
			return (
				<div className="flex flex-col gap-1.5">
					<dl className="flex flex-col gap-1">
						{detail.to && <Row label="To">{detail.to}</Row>}
						{detail.cc && <Row label="Cc">{detail.cc}</Row>}
						{detail.subject && <Row label="Subject">{detail.subject}</Row>}
					</dl>
					{detail.body && (
						<div className="od-selectable max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-sunken p-2 text-sm text-fg-2">
							{detail.body}
						</div>
					)}
				</div>
			);
		case "shell":
			return <Code>{detail.command}</Code>;
		case "file":
			return (
				<div className="flex flex-col gap-1.5">
					<dl>
						<Row label={FILE_VERBS[detail.operation]}>
							<span className="font-mono text-xs">{detail.path}</span>
						</Row>
					</dl>
					{detail.preview && (
						<>
							<Code>{detail.preview}</Code>
							{detail.previewTruncated && <p className="text-2xs text-fg-3">Preview shortened.</p>}
						</>
					)}
				</div>
			);
		case "message":
			return (
				<div className="flex flex-col gap-1.5">
					{detail.to && (
						<dl>
							<Row label="To">{detail.to}</Row>
						</dl>
					)}
					<div className="od-selectable max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-sunken p-2 text-sm text-fg-2">
						{detail.text}
					</div>
				</div>
			);
		default:
			return <Code>{detail.json}</Code>;
	}
}

/** What the tool will do, in readable form. */
export function ApprovalDetailView({ approval }: { approval: ApprovalRequest }) {
	const detail = useMemo(
		() => (approval.toolName ? formatApprovalDetail(approval.toolName, approval.args) : undefined),
		[approval.toolName, approval.args],
	);
	if (!detail) return approval.detail ? <p className="text-sm text-fg-2">{approval.detail}</p> : null;
	return <DetailBody detail={detail} />;
}
