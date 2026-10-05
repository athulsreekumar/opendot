import type { DotId, DotLink, LinkDecision } from "@shared/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Avatar,
	Button,
	Dialog,
	DialogFooter,
	EmptyState,
	IconButton,
	Menu,
	MenuContent,
	MenuItem,
	MenuTrigger,
	Select,
	Switch,
	toast,
} from "@/design-system/components";
import { IconLinks, IconMore, IconPlus, IconShield } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { LinkActivity } from "./LinkActivity";
import { LinkGraph } from "./LinkGraph";
import { LinkRuleEditor } from "./LinkRuleEditor";
import { ruleSort, SubjectChip, summarizeSchedule } from "./subjects";

const MAX_GRAPH_DOTS = 15;

export function LinksScreen() {
	const allDots = useDots((s) => s.dots);
	const dots = useMemo(() => allDots.filter((d) => !d.archived), [allDots]);
	const [links, setLinks] = useState<DotLink[] | undefined>();
	const [decisions, setDecisions] = useState<Record<string, LinkDecision>>({});
	const [editor, setEditor] = useState<{ rule?: DotLink } | undefined>();
	const [deleting, setDeleting] = useState<DotLink | undefined>();

	const reload = useCallback(async () => {
		try {
			setLinks(await api.links.list());
		} catch (e) {
			setLinks([]);
			toast({ title: "Couldn't load rules", description: errorText(e), variant: "error" });
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const graphDots = useMemo(() => dots.slice(0, MAX_GRAPH_DOTS), [dots]);
	const signature = `${graphDots.map((d) => d.id).join(",")}|${(links ?? []).map((l) => `${l.id}${l.enabled}${l.effect}${l.approval}`).join(",")}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: signature captures dots + rules
	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			const pairs: Array<[DotId, DotId]> = [];
			for (const a of graphDots) for (const b of graphDots) if (a.id !== b.id) pairs.push([a.id, b.id]);
			const results = await Promise.all(
				pairs.map(([a, b]) =>
					api.links
						.simulate(a, b)
						.then((d) => [`${a}>${b}` as string, d] as const)
						.catch(() => undefined),
				),
			);
			if (cancelled) return;
			setDecisions(Object.fromEntries(results.filter((r): r is readonly [string, LinkDecision] => !!r)));
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [signature]);

	const sorted = useMemo(() => [...(links ?? [])].sort(ruleSort), [links]);

	const toggle = async (rule: DotLink, enabled: boolean) => {
		try {
			const { id, createdAt: _c, ...rest } = rule;
			await api.links.upsert({ ...rest, id, enabled });
			await reload();
		} catch (e) {
			toast({ title: "Couldn't update the rule", description: errorText(e), variant: "error" });
		}
	};

	const remove = async (rule: DotLink) => {
		try {
			await api.links.remove(rule.id);
			setDeleting(undefined);
			await reload();
		} catch (e) {
			toast({ title: "Couldn't delete the rule", description: errorText(e), variant: "error" });
		}
	};

	const superCoordinate = async () => {
		const sup = dots.find((d) => d.kind === "super");
		if (!sup) {
			toast({ title: "No SuperDot yet", variant: "warning" });
			return;
		}
		try {
			await api.links.upsert({
				from: { kind: "super" },
				to: { kind: "any" },
				effect: "allow",
				enabled: true,
				approval: "ask",
				maxPerHour: 10,
				sharePii: false,
				purpose: "Coordinate all Dots",
			});
			await reload();
		} catch (e) {
			toast({ title: "Couldn't create the rule", description: errorText(e), variant: "error" });
		}
	};

	const header = (
		<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<h1 className="text-3xl font-semibold text-fg">Dot Links</h1>
				<p className="mt-1 text-md text-fg-2">Decide which Dots can talk to each other, and when.</p>
			</div>
			<Button leadingIcon={<IconPlus size={16} />} onClick={() => setEditor({})}>
				New rule
			</Button>
		</div>
	);

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto w-full max-w-[1100px] p-8">
				{header}
				{links && links.length === 0 ? (
					<div className="flex flex-col items-center gap-4 py-12">
						<div className="flex items-center gap-3" aria-hidden>
							{dots.slice(0, 2).map((d) => (
								<Avatar
									key={d.id}
									size="lg"
									emoji={d.appearance.emoji}
									color={d.appearance.color}
									name={d.name}
									mark={d.kind === "super"}
								/>
							))}
						</div>
						<EmptyState
							icon={<IconLinks size={28} />}
							title="Dots can't talk to each other yet"
							body="Create a rule to let one Dot message another."
							action={{ label: "Create a rule", onClick: () => setEditor({}) }}
						/>
						<Button variant="secondary" onClick={superCoordinate}>
							Let SuperDot coordinate all Dots (ask each time)
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-8">
						<div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-5">
							<div className="flex flex-col items-center gap-2 min-[900px]:col-span-3">
								<LinkGraph
									dots={graphDots}
									links={links ?? []}
									decisions={decisions}
									onOpenRule={(id) => setEditor({ rule: links?.find((l) => l.id === id) })}
								/>
								{dots.length > MAX_GRAPH_DOTS && (
									<p className="text-xs text-fg-3">Showing the first {MAX_GRAPH_DOTS} Dots.</p>
								)}
								<div className="flex flex-wrap justify-center gap-4 text-xs text-fg-3">
									<span>Solid: automatic</span>
									<span>Dashed: asks you</span>
									<span className="text-danger">✕ Blocked</span>
								</div>
							</div>
							<div className="min-[900px]:col-span-2">
								<RulesTable
									rules={sorted}
									onEdit={(r) => setEditor({ rule: r })}
									onDelete={setDeleting}
									onToggle={toggle}
								/>
							</div>
						</div>
						<TestBox />
						<LinkActivity />
					</div>
				)}
				{editor && (
					<LinkRuleEditor
						open
						rule={editor.rule}
						onOpenChange={(o) => !o && setEditor(undefined)}
						onSaved={() => void reload()}
					/>
				)}
				<Dialog
					open={!!deleting}
					onOpenChange={(o) => !o && setDeleting(undefined)}
					size="sm"
					title="Delete this rule?"
					footer={
						<DialogFooter>
							<Button variant="ghost" onClick={() => setDeleting(undefined)}>
								Cancel
							</Button>
							<Button variant="danger" onClick={() => deleting && void remove(deleting)}>
								Delete
							</Button>
						</DialogFooter>
					}
				>
					<p className="text-sm text-fg-2">Dots covered only by this rule will no longer be able to talk.</p>
				</Dialog>
			</div>
		</div>
	);
}

function RulesTable({
	rules,
	onEdit,
	onDelete,
	onToggle,
}: {
	rules: DotLink[];
	onEdit: (r: DotLink) => void;
	onDelete: (r: DotLink) => void;
	onToggle: (r: DotLink, enabled: boolean) => void;
}) {
	const dots = useDots((s) => s.dots);
	return (
		<div className="flex flex-col gap-2">
			<h2 className="text-lg font-semibold text-fg">Rules</h2>
			<ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-elevated">
				{rules.map((r) => (
					<li key={r.id} className="flex flex-col gap-2 p-3">
						<div className="flex flex-wrap items-center gap-2">
							<SubjectChip subject={r.from} dots={dots} />
							<span className="text-fg-3">→</span>
							<SubjectChip subject={r.to} dots={dots} />
							<div className="ml-auto flex items-center gap-1">
								<Switch aria-label="Enabled" checked={r.enabled} onCheckedChange={(on) => onToggle(r, on)} />
								<Menu>
									<MenuTrigger asChild>
										<IconButton label="Rule actions" icon={<IconMore size={16} />} size="sm" />
									</MenuTrigger>
									<MenuContent>
										<MenuItem onSelect={() => onEdit(r)}>Edit</MenuItem>
										<MenuItem destructive onSelect={() => onDelete(r)}>
											Delete
										</MenuItem>
									</MenuContent>
								</Menu>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-2">
							<span className={r.effect === "deny" ? "font-medium text-danger" : "font-medium text-success"}>
								{r.effect === "deny" ? "Block" : "Allow"}
							</span>
							{r.effect === "allow" && <span>{r.approval === "ask" ? "Ask each time" : "Automatic"}</span>}
							<span>{summarizeSchedule(r.schedule)}</span>
							<span>{r.maxPerHour}/h</span>
							{r.sharePii && (
								<span className="inline-flex items-center gap-1 text-warning" title="Shares personal details">
									<IconShield size={12} /> Personal details
								</span>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

function TestBox() {
	const allDots = useDots((s) => s.dots);
	const dots = useMemo(() => allDots.filter((d) => !d.archived), [allDots]);
	const [a, setA] = useState<string>("");
	const [b, setB] = useState<string>("");
	const [result, setResult] = useState<LinkDecision | undefined>();

	useEffect(() => {
		if (!a && dots[0]) setA(dots[0].id);
		if (!b && dots[1]) setB(dots[1].id);
	}, [dots, a, b]);

	useEffect(() => {
		if (!a || !b || a === b) {
			setResult(undefined);
			return;
		}
		let cancelled = false;
		api.links
			.simulate(a as DotId, b as DotId)
			.then((d) => !cancelled && setResult(d))
			.catch(() => !cancelled && setResult(undefined));
		return () => {
			cancelled = true;
		};
	}, [a, b]);

	const groups = [{ items: dots.map((d) => ({ value: d.id, label: d.name })) }];
	return (
		<section className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-elevated p-4">
			<h2 className="text-lg font-semibold text-fg">Test</h2>
			<div className="flex flex-wrap items-center gap-2 text-sm text-fg-2">
				Can
				<Select size="sm" aria-label="Sender" value={a} onValueChange={setA} groups={groups} />
				message
				<Select size="sm" aria-label="Receiver" value={b} onValueChange={setB} groups={groups} />
				right now?
			</div>
			{result && (
				<p className="text-sm" aria-live="polite">
					<span className={result.allowed ? "font-medium text-success" : "font-medium text-danger"}>
						{result.allowed ? (result.approval === "ask" ? "Yes, after you approve" : "Yes") : "No"}
					</span>
					<span className="text-fg-2"> · {result.reason}</span>
				</p>
			)}
		</section>
	);
}
