import type { DotId, DotLink, LinkApproval, LinkDecision, LinkSchedule, LinkSubject } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/design-system/cn";
import {
	Button,
	Dialog,
	DialogFooter,
	Input,
	SegmentedControl,
	Select,
	type SelectGroup,
	Slider,
	Switch,
	toast,
} from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { subjectToValue, valueToSubject } from "./subjects";

const DAYS: Array<{ label: string; value: number; name: string }> = [
	{ label: "M", value: 1, name: "Monday" },
	{ label: "T", value: 2, name: "Tuesday" },
	{ label: "W", value: 3, name: "Wednesday" },
	{ label: "T", value: 4, name: "Thursday" },
	{ label: "F", value: 5, name: "Friday" },
	{ label: "S", value: 6, name: "Saturday" },
	{ label: "S", value: 0, name: "Sunday" },
];

function systemZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}

function zoneList(current: string): string[] {
	let zones: string[] = [];
	try {
		zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
	} catch {
		zones = [];
	}
	const set = new Set(["UTC", ...zones]);
	set.add(current);
	return [...set];
}

export interface LinkRuleEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Existing rule to edit. */
	rule?: DotLink;
	/** Prefill for a new rule. */
	initial?: { from?: LinkSubject; to?: LinkSubject };
	onSaved?: (rule: DotLink) => void;
}

export function LinkRuleEditor({ open, onOpenChange, rule, initial, onSaved }: LinkRuleEditorProps) {
	const dots = useDots((s) => s.dots);
	const active = useMemo(() => dots.filter((d) => !d.archived), [dots]);
	const roles = useMemo(() => [...new Set(active.flatMap((d) => d.roles))].sort(), [active]);

	const [from, setFrom] = useState("any");
	const [to, setTo] = useState("any");
	const [effect, setEffect] = useState<"allow" | "deny">("allow");
	const [approval, setApproval] = useState<LinkApproval>("ask");
	const [scheduled, setScheduled] = useState(false);
	const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
	const [start, setStart] = useState("09:00");
	const [end, setEnd] = useState("18:00");
	const [timeZone, setTimeZone] = useState(systemZone());
	const [rate, setRate] = useState(10);
	const [sharePii, setSharePii] = useState(false);
	const [purpose, setPurpose] = useState("");
	const [saving, setSaving] = useState(false);
	const [sim, setSim] = useState<LinkDecision | undefined>();

	useEffect(() => {
		if (!open) return;
		const f = rule?.from ?? initial?.from ?? { kind: "any" };
		const t = rule?.to ?? initial?.to ?? { kind: "any" };
		setFrom(subjectToValue(f));
		setTo(subjectToValue(t));
		setEffect(rule?.effect ?? "allow");
		setApproval(rule?.approval ?? "ask");
		setScheduled(!!rule?.schedule);
		setDays(rule?.schedule?.days ?? [1, 2, 3, 4, 5]);
		setStart(rule?.schedule?.start ?? "09:00");
		setEnd(rule?.schedule?.end ?? "18:00");
		setTimeZone(rule?.schedule?.timeZone ?? systemZone());
		setRate(rule?.maxPerHour ?? 10);
		setSharePii(rule?.sharePii ?? false);
		setPurpose(rule?.purpose ?? "");
		setSim(undefined);
	}, [open, rule, initial]);

	const fromSubject = valueToSubject(from);
	const toSubject = valueToSubject(to);
	const fromId = fromSubject.kind === "dot" ? fromSubject.dotId : undefined;
	const toId = toSubject.kind === "dot" ? toSubject.dotId : undefined;

	useEffect(() => {
		if (!open || !fromId || !toId || fromId === toId) {
			setSim(undefined);
			return;
		}
		let cancelled = false;
		api.links
			.simulate(fromId as DotId, toId as DotId)
			.then((d) => !cancelled && setSim(d))
			.catch(() => !cancelled && setSim(undefined));
		return () => {
			cancelled = true;
		};
	}, [open, fromId, toId]);

	const groups = (): SelectGroup[] => {
		const g: SelectGroup[] = [
			{
				label: "Dots",
				items: active.filter((d) => d.kind !== "super").map((d) => ({ value: `dot:${d.id}`, label: d.name })),
			},
		];
		if (roles.length) g.push({ label: "Roles", items: roles.map((r) => ({ value: `role:${r}`, label: `#${r}` })) });
		g.push({
			label: "Everyone",
			items: [
				...(active.some((d) => d.kind === "super") ? [{ value: "super", label: "SuperDot" }] : []),
				{ value: "any", label: "Any Dot" },
			],
		});
		return g;
	};

	const save = async () => {
		setSaving(true);
		try {
			const schedule: LinkSchedule | undefined = scheduled ? { timeZone, days, start, end } : undefined;
			const saved = await api.links.upsert({
				...(rule ? { id: rule.id } : {}),
				from: fromSubject,
				to: toSubject,
				effect,
				enabled: rule?.enabled ?? true,
				approval,
				schedule,
				maxPerHour: rate,
				sharePii,
				purpose: purpose.trim(),
			});
			onSaved?.(saved);
			onOpenChange(false);
		} catch (e) {
			toast({ title: "Couldn't save the rule", description: errorText(e), variant: "error" });
		} finally {
			setSaving(false);
		}
	};

	const field = "flex flex-col gap-1 text-sm text-fg-2";

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={rule ? "Edit rule" : "New rule"}
			size="lg"
			footer={
				<div className="flex items-center justify-between gap-4">
					<p className="min-h-5 text-sm text-fg-2" aria-live="polite">
						{sim ? (
							<>
								<span className="font-medium text-fg">Effective result: </span>
								{sim.allowed
									? sim.approval === "ask"
										? "Allowed, asks you first"
										: "Allowed automatically"
									: "Blocked"}
								{sim.reason ? ` (${sim.reason})` : ""}
							</>
						) : null}
					</p>
					<DialogFooter>
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={save} loading={saving}>
							Save rule
						</Button>
					</DialogFooter>
				</div>
			}
		>
			<div className="flex flex-col gap-5">
				<div className="grid grid-cols-2 gap-3">
					<div className={field}>
						From
						<Select aria-label="From" value={from} onValueChange={setFrom} groups={groups()} />
					</div>
					<div className={field}>
						To
						<Select aria-label="To" value={to} onValueChange={setTo} groups={groups()} />
					</div>
				</div>
				<div className={field}>
					Effect
					<SegmentedControl
						aria-label="Effect"
						value={effect}
						onValueChange={(v) => setEffect(v as "allow" | "deny")}
						options={[
							{ value: "allow", label: "Allow" },
							{ value: "deny", label: "Block" },
						]}
					/>
				</div>
				{effect === "allow" && (
					<div className={field}>
						Approval
						<SegmentedControl
							aria-label="Approval"
							value={approval}
							onValueChange={(v) => setApproval(v as LinkApproval)}
							options={[
								{ value: "ask", label: "Ask me each time" },
								{ value: "auto", label: "Automatic" },
							]}
						/>
					</div>
				)}
				<div className={field}>
					When
					<SegmentedControl
						aria-label="When"
						value={scheduled ? "schedule" : "any"}
						onValueChange={(v) => setScheduled(v === "schedule")}
						options={[
							{ value: "any", label: "Any time" },
							{ value: "schedule", label: "Schedule" },
						]}
					/>
					{scheduled && (
						<div className="mt-2 flex flex-col gap-3 rounded-md bg-sunken p-3">
							<div className="flex gap-1.5">
								{DAYS.map((d) => {
									const on = days.includes(d.value);
									return (
										<button
											key={d.value}
											type="button"
											aria-label={d.name}
											aria-pressed={on}
											onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== d.value) : [...cur, d.value]))}
											className={cn(
												"h-8 w-8 rounded-full text-sm font-medium transition-colors",
												on ? "bg-accent text-accent-fg" : "bg-active text-fg-2 hover:text-fg",
											)}
										>
											{d.label}
										</button>
									);
								})}
							</div>
							<div className="flex items-center gap-2">
								<Input type="time" aria-label="Start time" value={start} onChange={(e) => setStart(e.target.value)} />
								<span className="text-fg-3">to</span>
								<Input type="time" aria-label="End time" value={end} onChange={(e) => setEnd(e.target.value)} />
							</div>
							<Select
								aria-label="Time zone"
								value={timeZone}
								onValueChange={setTimeZone}
								groups={[{ items: zoneList(timeZone).map((z) => ({ value: z, label: z })) }]}
							/>
						</div>
					)}
				</div>
				<div className={field}>
					<span>
						Rate limit: <span className="font-medium text-fg">{rate} per hour</span>
					</span>
					<Slider aria-label="Rate limit per hour" min={1} max={120} value={rate} onValueChange={setRate} />
				</div>
				<div className="flex flex-col gap-1">
					<Switch label="Share personal details" checked={sharePii} onCheckedChange={setSharePii} />
					<p className="text-xs text-fg-3">When off, personal details stay masked between Dots.</p>
				</div>
				{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input */}
				<label className={field}>
					Purpose
					<Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Why can these Dots talk?" />
				</label>
			</div>
		</Dialog>
	);
}
