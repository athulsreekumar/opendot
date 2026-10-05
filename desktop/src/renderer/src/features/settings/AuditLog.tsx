import type { AuditEntry, AuditKind } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Badge, Button, Select, Spinner, toast } from "@/design-system/components";
import { IconDownload } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { listTime } from "@/lib/format";
import { useDots } from "@/stores/dots";

const ROW_H = 44;
const VIEW_H = 480;
const OVERSCAN = 6;
const PAGE = 200;

const KINDS: AuditKind[] = [
	"tool-call",
	"tool-blocked",
	"approval",
	"link-exchange",
	"link-blocked",
	"pii-redaction",
	"connection-change",
	"settings-change",
	"event",
];

const kindVariant = (k: AuditKind) =>
	k.endsWith("blocked") ? "danger" : k === "approval" ? "warning" : k === "pii-redaction" ? "info" : "muted";

export function AuditLog() {
	const dots = useDots((s) => s.dots);
	const [dotId, setDotId] = useState("all");
	const [kind, setKind] = useState("all");
	const [rows, setRows] = useState<AuditEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [done, setDone] = useState(false);
	const [scrollTop, setScrollTop] = useState(0);
	const [exporting, setExporting] = useState(false);
	const loadingRef = useRef(false);

	const fetchPage = useCallback(
		async (before: string | undefined, replace: boolean) => {
			if (loadingRef.current) return;
			loadingRef.current = true;
			setLoading(true);
			try {
				const page = await api.audit.query({
					dotId: dotId === "all" ? undefined : (dotId as AuditEntry["dotId"]),
					kinds: kind === "all" ? undefined : [kind as AuditKind],
					before,
					limit: PAGE,
				});
				setRows((r) => (replace ? page : [...r, ...page]));
				setDone(page.length < PAGE);
			} catch (e) {
				toast({ title: "Couldn't load the audit log", description: errorText(e), variant: "error" });
			} finally {
				loadingRef.current = false;
				setLoading(false);
			}
		},
		[dotId, kind],
	);

	useEffect(() => {
		setScrollTop(0);
		setDone(false);
		void fetchPage(undefined, true);
	}, [fetchPage]);

	const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
	const end = Math.min(rows.length, Math.ceil((scrollTop + VIEW_H) / ROW_H) + OVERSCAN);

	const exportJsonl = async () => {
		setExporting(true);
		try {
			const { path } = await api.audit.exportJsonl();
			toast({ title: "Audit log exported", description: path, variant: "success" });
		} catch (e) {
			toast({ title: "Couldn't export", description: errorText(e), variant: "error" });
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Select
					aria-label="Filter by Dot"
					value={dotId}
					onValueChange={setDotId}
					groups={[
						{ items: [{ value: "all", label: "All Dots" }, ...dots.map((d) => ({ value: d.id, label: d.name }))] },
					]}
				/>
				<Select
					aria-label="Filter by kind"
					value={kind}
					onValueChange={setKind}
					groups={[{ items: [{ value: "all", label: "All kinds" }, ...KINDS.map((k) => ({ value: k, label: k }))] }]}
				/>
				<div className="flex-1" />
				<Button
					variant="secondary"
					loading={exporting}
					leadingIcon={<IconDownload size={14} />}
					onClick={() => void exportJsonl()}
				>
					Export
				</Button>
			</div>
			<div
				className="rounded-lg border border-border-subtle bg-elevated overflow-y-auto h-[480px]"
				onScroll={(e) => {
					const el = e.currentTarget;
					setScrollTop(el.scrollTop);
					if (!done && !loadingRef.current && el.scrollTop + VIEW_H >= el.scrollHeight - ROW_H * 4) {
						const last = rows[rows.length - 1];
						if (last) void fetchPage(last.at, false);
					}
				}}
			>
				{rows.length === 0 && !loading ? (
					<p className="p-6 text-sm text-fg-3 text-center">Nothing recorded yet.</p>
				) : (
					<div className="relative" style={{ height: rows.length * ROW_H }}>
						{rows.slice(start, end).map((r, i) => {
							const dot = dots.find((d) => d.id === r.dotId);
							return (
								<div
									key={r.id}
									className="absolute left-0 right-0 flex items-center gap-3 px-3 border-b border-border-subtle"
									style={{ top: (start + i) * ROW_H, height: ROW_H }}
								>
									<span className="w-16 shrink-0 text-xs text-fg-3">{listTime(r.at)}</span>
									{dot ? (
										<Avatar
											size="xs"
											color={dot.appearance.color}
											emoji={dot.appearance.emoji}
											name={dot.name}
											mark={dot.kind === "super"}
										/>
									) : (
										<span className="w-6 shrink-0" />
									)}
									<Badge variant={kindVariant(r.kind)} className="shrink-0">
										{r.kind}
									</Badge>
									<span className="flex-1 truncate text-sm text-fg" title={r.summary}>
										{r.summary}
									</span>
								</div>
							);
						})}
					</div>
				)}
				{loading && (
					<div className="flex justify-center p-3">
						<Spinner />
					</div>
				)}
			</div>
		</div>
	);
}
