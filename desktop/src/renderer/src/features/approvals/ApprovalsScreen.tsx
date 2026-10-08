import type { ApprovalHistoryItem, ApprovalHistoryOutcome, ApprovalRequest, Dot } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import {
	Avatar,
	Badge,
	Button,
	Select,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	toast,
} from "@/design-system/components";
import { IconApprove } from "@/design-system/icons";
import { errorText } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useApprovals } from "@/stores/approvals";
import { useDots } from "@/stores/dots";
import { ApprovalItemCard } from "./ApprovalItemCard";

/** Group by Dot once the list is long enough that a flat list gets hard to scan. */
export const GROUP_AT = 3;

export function groupByDot(items: ApprovalRequest[]): Array<{ dotId: string; items: ApprovalRequest[] }> {
	const order: string[] = [];
	const map = new Map<string, ApprovalRequest[]>();
	for (const a of items) {
		if (!map.has(a.dotId)) {
			map.set(a.dotId, []);
			order.push(a.dotId);
		}
		map.get(a.dotId)!.push(a);
	}
	return order.map((dotId) => ({ dotId, items: map.get(dotId)! }));
}

function DotAvatar({ dot }: { dot?: Dot }) {
	return (
		<Avatar
			size="xs"
			name={dot?.name ?? "Dot"}
			icon={dot?.appearance.icon}
			color={dot?.appearance.color ?? "teal"}
			mark={dot?.kind === "super"}
		/>
	);
}

function WaitingList({ approvalId }: { approvalId?: string }) {
	const pending = useApprovals((s) => s.pending);
	const dots = useDots((s) => s.dots);
	const byId = (id: string) => dots.find((d) => d.id === id);
	const sorted = useMemo(() => [...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [pending]);
	const grouped = sorted.length >= GROUP_AT;

	// Opened from a notification: bring that card into view and focus it so A / D / E work at once.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run when cards arrive so the target gets focus
	useEffect(() => {
		if (!approvalId) return;
		const el = document.querySelector<HTMLElement>(`[data-approval-id="${approvalId}"]`);
		el?.scrollIntoView({ block: "center" });
		el?.focus();
	}, [approvalId, sorted.length]);

	const denyAll = async (dotId: string) => {
		try {
			const n = await useApprovals.getState().denyAll(dotId as Dot["id"]);
			toast({ title: n === 1 ? "Denied 1 request" : `Denied ${n} requests`, variant: "success" });
		} catch (e) {
			toast({ title: "Couldn't deny them", description: errorText(e), variant: "error" });
		}
	};

	if (sorted.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
				<IconApprove size={28} className="text-fg-3" />
				<p className="text-md font-medium text-fg">Nothing is waiting for you.</p>
				<p className="max-w-[360px] text-sm text-fg-2">
					When a Dot needs your OK to send, delete or run something, it shows up here.
				</p>
			</div>
		);
	}

	if (!grouped) {
		return (
			<ul className="flex flex-col gap-3">
				{sorted.map((a) => (
					<li key={a.id}>
						<ApprovalItemCard approval={a} dot={byId(a.dotId)} showDot highlight={a.id === approvalId} />
					</li>
				))}
			</ul>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{groupByDot(sorted).map((g) => {
				const dot = byId(g.dotId);
				return (
					<section key={g.dotId} aria-label={dot?.name ?? "Dot"}>
						<div className="mb-2 flex items-center gap-2">
							<DotAvatar dot={dot} />
							<h2 className="text-md font-semibold text-fg">{dot?.name ?? "A Dot"}</h2>
							<Badge variant="muted">{g.items.length}</Badge>
							<div className="flex-1" />
							<Button size="sm" variant="ghost" className="text-danger" onClick={() => void denyAll(g.dotId)}>
								Deny all
							</Button>
						</div>
						<ul className="flex flex-col gap-3">
							{g.items.map((a) => (
								<li key={a.id}>
									<ApprovalItemCard approval={a} dot={dot} showDot={false} highlight={a.id === approvalId} />
								</li>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}

const OUTCOME: Record<ApprovalHistoryOutcome, { label: string; variant: "success" | "danger" | "info" | "muted" }> = {
	allowed: { label: "Allowed", variant: "success" },
	edited: { label: "Edited", variant: "info" },
	denied: { label: "Denied", variant: "danger" },
	expired: { label: "Expired", variant: "muted" },
};

function byLabel(item: ApprovalHistoryItem): string {
	if (item.by === "rule") return "By your Always allow rule";
	if (item.by === "timeout") return "Nobody answered in time";
	if (item.by === "stopped") return "The Dot was stopped";
	return item.always ? "By you, and always allowed" : "By you";
}

function HistoryList() {
	const history = useApprovals((s) => s.history);
	const loaded = useApprovals((s) => s.historyLoaded);
	const dots = useDots((s) => s.dots);
	const [dotFilter, setDotFilter] = useState("all");
	const [outcomeFilter, setOutcomeFilter] = useState("all");

	useEffect(() => {
		void useApprovals
			.getState()
			.loadHistory()
			.catch(() => undefined);
	}, []);

	const rows = history.filter(
		(h) => (dotFilter === "all" || h.dotId === dotFilter) && (outcomeFilter === "all" || h.outcome === outcomeFilter),
	);
	const dotName = (id?: string) => dots.find((d) => d.id === id)?.name ?? "A Dot";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<div className="w-[200px]">
					<Select
						size="sm"
						aria-label="Filter by Dot"
						value={dotFilter}
						onValueChange={setDotFilter}
						groups={[
							{
								items: [
									{ value: "all", label: "All Dots" },
									...dots.filter((d) => !d.archived).map((d) => ({ value: d.id, label: d.name })),
								],
							},
						]}
					/>
				</div>
				<div className="w-[180px]">
					<Select
						size="sm"
						aria-label="Filter by outcome"
						value={outcomeFilter}
						onValueChange={setOutcomeFilter}
						groups={[
							{
								items: [
									{ value: "all", label: "Any outcome" },
									{ value: "allowed", label: "Allowed" },
									{ value: "denied", label: "Denied" },
									{ value: "edited", label: "Edited" },
									{ value: "expired", label: "Expired" },
								],
							},
						]}
					/>
				</div>
			</div>
			{rows.length === 0 ? (
				<p className="px-2 py-12 text-center text-sm text-fg-2">{loaded ? "No decisions here yet." : "Loading…"}</p>
			) : (
				<ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-elevated">
					{rows.map((h) => (
						<li key={h.id} data-testid="approval-history-row" className="flex items-start gap-3 px-4 py-3">
							<DotAvatar dot={dots.find((d) => d.id === h.dotId)} />
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<Badge variant={OUTCOME[h.outcome].variant}>{OUTCOME[h.outcome].label}</Badge>
									<span className="truncate text-sm font-medium text-fg">{h.summary}</span>
								</div>
								<p className="mt-0.5 text-xs text-fg-3">
									{dotName(h.dotId)} · {byLabel(h)}
									{h.hasReason ? " · with a reason" : ""}
								</p>
							</div>
							<time dateTime={h.at} title={new Date(h.at).toLocaleString()} className="shrink-0 text-xs text-fg-3">
								{relativeTime(h.at)}
							</time>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function ApprovalsScreen({ approvalId }: { approvalId?: string }) {
	const count = useApprovals((s) => s.pending.length);
	const [tab, setTab] = useState("waiting");
	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto w-full max-w-[860px] p-8">
				<h1 className="text-3xl font-semibold text-fg">Approvals</h1>
				<p className="mt-1 text-md text-fg-2">Your Dots ask here before they send, delete or run anything.</p>
				<Tabs value={tab} onValueChange={setTab} className="mt-6">
					<TabsList>
						<TabsTrigger value="waiting">{count > 0 ? `Waiting (${count})` : "Waiting"}</TabsTrigger>
						<TabsTrigger value="history">History</TabsTrigger>
					</TabsList>
					<TabsContent value="waiting">
						<WaitingList approvalId={approvalId} />
					</TabsContent>
					<TabsContent value="history">
						<HistoryList />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
