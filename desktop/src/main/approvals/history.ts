// Decided approvals for the inbox History tab. Stored as `approval` entries in the audit log
// (~/.opendot/audit/audit.jsonl): a masked one-line summary and flags, never message contents (spec 06 §6).
import { summarizeApproval } from "../../shared/approvals/describe";
import { newId } from "../../shared/ids";
import {
	type ApprovalHistoryItem,
	type ApprovalHistoryOutcome,
	type ApprovalRequest,
	type AuditEntry,
	type DotId,
	PII_TYPES,
	type PiiSettings,
} from "../../shared/types";
import { detectPii } from "../pii/detectors";
import type { ApprovalResolution } from "../security/approval-broker";

/** Replace PII in a short summary with plain markers like [email]. */
export function maskSummary(text: string, pii: PiiSettings): string {
	const spans = detectPii(text, {
		types: new Set(PII_TYPES),
		customTerms: pii.customTerms,
		detectNames: pii.detectNames,
	});
	let out = text;
	for (const s of [...spans].sort((a, b) => b.start - a.start)) {
		out = `${out.slice(0, s.start)}[${s.type.toLowerCase().replace("_", " ")}]${out.slice(s.end)}`;
	}
	return out;
}

const OUTCOMES = new Set<string>(["allowed", "denied", "edited", "expired"]);

/** Audit entry -> history item. Also reads the older entries that only had { tool, outcome: "allow-once" | ... }. */
export function toHistoryItem(e: AuditEntry): ApprovalHistoryItem | undefined {
	if (e.kind !== "approval") return undefined;
	const d = e.data;
	let outcome: ApprovalHistoryOutcome;
	let always = d.always === true;
	if (typeof d.outcome === "string" && OUTCOMES.has(d.outcome)) outcome = d.outcome as ApprovalHistoryOutcome;
	else if (d.outcome === "allow-once" || d.outcome === "allow-always") {
		outcome = "allowed";
		always = d.outcome === "allow-always";
	} else if (d.outcome === "expired") outcome = "expired";
	else outcome = "denied";
	const by = d.by === "rule" || d.by === "timeout" || d.by === "stopped" ? d.by : "you";
	return {
		id: e.id,
		approvalId: typeof d.approvalId === "string" ? d.approvalId : undefined,
		at: e.at,
		dotId: e.dotId,
		outcome,
		by,
		...(always ? { always: true } : {}),
		...(d.hasReason === true ? { hasReason: true } : {}),
		kind: d.kind === "link" ? "link" : "tool",
		toolName: typeof d.tool === "string" ? d.tool : undefined,
		summary: e.summary,
	};
}

export interface ApprovalHistoryDeps {
	append(entry: AuditEntry): Promise<void>;
	read(q: { dotId?: DotId; limit?: number }): Promise<AuditEntry[]>;
	piiSettings(): Promise<PiiSettings>;
}

export class ApprovalHistory {
	constructor(private readonly deps: ApprovalHistoryDeps) {}

	private async write(
		dotId: DotId,
		summary: string,
		data: AuditEntry["data"],
		outcome: ApprovalHistoryOutcome,
	): Promise<ApprovalHistoryItem> {
		const pii = await this.deps.piiSettings().catch(() => ({ enabledTypes: [], customTerms: [], detectNames: false }));
		const entry: AuditEntry = {
			id: newId("aud"),
			at: new Date().toISOString(),
			kind: "approval",
			dotId,
			summary: maskSummary(summary, pii as PiiSettings),
			data: { ...data, outcome },
		};
		await this.deps.append(entry);
		return toHistoryItem(entry)!;
	}

	/** A request the user (or the clock) decided. */
	async record(req: ApprovalRequest, res: ApprovalResolution): Promise<ApprovalHistoryItem> {
		const edited = res.outcome !== "deny" && res.outcome !== "expired" && !!res.editedArgs;
		const outcome: ApprovalHistoryOutcome =
			res.outcome === "expired" ? "expired" : res.outcome === "deny" ? "denied" : edited ? "edited" : "allowed";
		const summary = req.toolName ? summarizeApproval(req.toolName, req.args) : req.title;
		return this.write(
			req.dotId,
			summary,
			{
				approvalId: req.id,
				kind: req.kind,
				tool: req.toolName ?? null,
				by: res.by,
				always: res.outcome === "allow-always",
				hasReason: !!res.reason,
			},
			outcome,
		);
	}

	/** A call that would have asked, but an Always allow rule let it through. */
	async recordRule(dotId: DotId, toolName: string, args: unknown): Promise<ApprovalHistoryItem> {
		return this.write(
			dotId,
			summarizeApproval(toolName, args),
			{ kind: "tool", tool: toolName, by: "rule" },
			"allowed",
		);
	}

	async list(
		q: { dotId?: DotId; outcome?: ApprovalHistoryOutcome; limit?: number } = {},
	): Promise<ApprovalHistoryItem[]> {
		const limit = q.limit ?? 200;
		// Read generously: other audit kinds share the file.
		const entries = await this.deps.read({ dotId: q.dotId, limit: limit * 20 });
		const out: ApprovalHistoryItem[] = [];
		for (const e of entries) {
			const item = toHistoryItem(e);
			if (!item || (q.outcome && item.outcome !== q.outcome)) continue;
			out.push(item);
			if (out.length >= limit) break;
		}
		return out;
	}
}
