import type { Connection, ConnectionGrant, Dot, ToolDecision } from "@shared/types";
import { useEffect, useState } from "react";
import { navigate } from "@/app/router";
import { Button, SegmentedControl, Switch, toast } from "@/design-system/components";
import { IconChevronDown, IconChevronRight, IconFolder, IconPlus } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";
import { ShellNote, useShellAvailable } from "../connections/ShellNote";
import { SectionCard } from "./ui";
import { useDotSaver } from "./useDotSaver";

const DECISIONS = [
	{ value: "allow", label: "Allow" },
	{ value: "ask", label: "Ask" },
	{ value: "deny", label: "Block" },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Effective sub-features of a grant: an empty/missing list means everything the connection has. */
function effectiveFeatures(grant: ConnectionGrant, conn: Connection): string[] {
	return grant.features?.length ? grant.features : conn.features;
}

export function ToolsSection({ dot }: { dot: Dot }) {
	const { save, saved } = useDotSaver(dot.id);
	const connections = useRuntime((s) => s.connections);
	const status = useRuntime((s) => s.connectionStatus);
	const shellOk = useShellAvailable();
	const [open, setOpen] = useState<Record<string, boolean>>({});
	const list = connections.filter((c) => c.enabled);
	const [always, setAlways] = useState<string[]>([]);
	useEffect(() => {
		void api.dots
			.alwaysAllowed(dot.id)
			.then(setAlways)
			.catch(() => undefined);
	}, [dot.id]);
	const forget = async (tool: string) => {
		await api.dots.forgetAllowed(dot.id, tool);
		setAlways((a) => a.filter((t) => t !== tool));
	};

	const grantOf = (id: string) => dot.grants.find((g) => g.connectionId === id);
	const writeGrant = (next: ConnectionGrant) =>
		save({ grants: dot.grants.map((g) => (g.connectionId === next.connectionId ? next : g)) }, { applies: true });

	const toggleConnection = (c: Connection, on: boolean) => {
		if (on) {
			if (grantOf(c.id)) return;
			save({ grants: [...dot.grants, { connectionId: c.id, toolRules: {} }] }, { applies: true });
		} else {
			save({ grants: dot.grants.filter((g) => g.connectionId !== c.id) }, { applies: true });
		}
	};

	const setFeatures = (g: ConnectionGrant, features: string[]) => writeGrant({ ...g, features });

	const addFolder = async (g: ConnectionGrant, c: Connection) => {
		try {
			const p = await api.app.pickFolder({ title: "Allow this Dot to use a folder" });
			if (!p) return;
			const feats = effectiveFeatures(g, c);
			if (!feats.includes(`folder:${p}`)) setFeatures(g, [...feats, `folder:${p}`]);
		} catch (e) {
			toast({ title: "Couldn't pick a folder", description: errorText(e), variant: "error" });
		}
	};

	return (
		<SectionCard
			title="Tools"
			saved={saved}
			testId="section-tools"
			right={
				<Button
					size="sm"
					variant="secondary"
					leadingIcon={<IconPlus size={14} />}
					onClick={() => navigate("#/connections")}
				>
					Install more
				</Button>
			}
		>
			{list.length === 0 && (
				<p className="text-sm text-fg-3">No connections installed yet. Install one to give this Dot more abilities.</p>
			)}
			<ul className="flex flex-col gap-2">
				{list.map((c) => {
					const g = grantOf(c.id);
					const tools = status[c.id]?.tools ?? [];
					const expanded = Boolean(open[c.id]);
					const defaultFor = (readOnly: boolean): ToolDecision => g?.defaultDecision ?? (readOnly ? "allow" : "ask");
					return (
						<li key={c.id} className="rounded-md bg-sunken px-3 py-2">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<div className="truncate text-md font-medium text-fg">{c.label}</div>
									<div className="truncate text-xs text-fg-3">{c.description}</div>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<span className="text-xs text-fg-2">Allowed for this Dot</span>
									<Switch
										aria-label={`Allow ${c.label}`}
										checked={Boolean(g)}
										onCheckedChange={(on) => toggleConnection(c, on)}
									/>
								</div>
							</div>

							{g && c.type === "mac" && (
								<div className="mt-2 flex flex-col gap-2 border-t border-border-subtle pt-2">
									{!shellOk && effectiveFeatures(g, c).includes("shell") && (
										<ShellNote className="text-xs text-warning" />
									)}
									{c.features
										.filter((f) => !f.startsWith("folder:"))
										.map((f) => {
											const feats = effectiveFeatures(g, c);
											return (
												<div key={f} className="flex flex-col gap-1">
													<Switch
														aria-label={`${cap(f)} for ${c.label}`}
														label={cap(f)}
														checked={feats.includes(f)}
														onCheckedChange={(on) => setFeatures(g, on ? [...feats, f] : feats.filter((x) => x !== f))}
													/>
													{f === "files" && feats.includes("files") && (
														<div className="ml-10 flex flex-col gap-1">
															<span className="text-xs font-medium text-fg-2">Allowed folders</span>
															{feats
																.filter((x) => x.startsWith("folder:"))
																.map((x) => (
																	<div key={x} className="flex items-center justify-between gap-2 text-xs text-fg">
																		<span className="flex min-w-0 items-center gap-1 font-mono">
																			<IconFolder size={12} />
																			<span className="truncate">{x.slice(7)}</span>
																		</span>
																		<button
																			type="button"
																			className="text-fg-3 hover:text-danger"
																			onClick={() =>
																				setFeatures(
																					g,
																					feats.filter((y) => y !== x),
																				)
																			}
																		>
																			Remove
																		</button>
																	</div>
																))}
															<div>
																<Button size="sm" variant="secondary" onClick={() => void addFolder(g, c)}>
																	Add folder…
																</Button>
															</div>
														</div>
													)}
												</div>
											);
										})}
								</div>
							)}

							{g && (c.type === "google" || c.type === "microsoft") && (
								<div className="mt-2 flex flex-col gap-2 border-t border-border-subtle pt-2">
									{c.features.map((f) => {
										const feats = effectiveFeatures(g, c);
										return (
											<Switch
												key={f}
												aria-label={`${cap(f)} for ${c.label}`}
												label={cap(f)}
												checked={feats.includes(f)}
												onCheckedChange={(on) => setFeatures(g, on ? [...feats, f] : feats.filter((x) => x !== f))}
											/>
										);
									})}
								</div>
							)}

							{g && tools.length > 0 && (
								<div className="mt-2 border-t border-border-subtle pt-2">
									<button
										type="button"
										aria-expanded={expanded}
										onClick={() => setOpen({ ...open, [c.id]: !expanded })}
										className="flex items-center gap-1 text-sm text-fg-2 hover:text-fg"
									>
										{expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
										{tools.length} tool{tools.length === 1 ? "" : "s"}
									</button>
									{expanded && (
										<ul className="mt-2 flex flex-col gap-2">
											{tools.map((t) => {
												const def = defaultFor(t.readOnly);
												const value = g.toolRules[t.name] ?? def;
												return (
													<li key={t.name} className="flex items-center justify-between gap-3">
														<div className="min-w-0">
															<div className="truncate font-mono text-xs text-fg">{t.name}</div>
															<div className="truncate text-xs text-fg-3">{t.description}</div>
														</div>
														<div className="flex shrink-0 items-center gap-2">
															{value === def && <span className="text-2xs text-fg-3">default</span>}
															<SegmentedControl
																size="sm"
																aria-label={`${t.name} decision`}
																value={value}
																options={DECISIONS}
																onValueChange={(v) => {
																	const rules = { ...g.toolRules };
																	if (v === def) delete rules[t.name];
																	else rules[t.name] = v as ToolDecision;
																	writeGrant({ ...g, toolRules: rules });
																}}
															/>
														</div>
													</li>
												);
											})}
										</ul>
									)}
								</div>
							)}
						</li>
					);
				})}
			</ul>
			{always.length > 0 && (
				<div className="mt-4 border-t border-border-subtle pt-3">
					<p className="mb-2 text-xs font-medium text-fg-2">Always-allowed actions</p>
					<ul className="flex flex-wrap gap-1.5">
						{always.map((t) => (
							<li key={t} className="flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-xs text-fg-2">
								<span className="font-mono">{t}</span>
								<button
									type="button"
									aria-label={`Stop always allowing ${t}`}
									className="text-fg-3 hover:text-danger"
									onClick={() => void forget(t)}
								>
									✕
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
		</SectionCard>
	);
}
