import type { Connection, McpExposure } from "@shared/types";
import { useEffect, useState } from "react";
import { navigate } from "@/app/router";
import { Avatar, Badge, Button, Dialog, DialogFooter, Select, Switch, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { useRuntime } from "@/stores/runtime";
import { KnowledgePanel } from "../knowledge/KnowledgePanel";
import { ConnectionStatePill, dotsUsing, IconTile } from "./ConnectionCard";
import { ShellNote, useShellAvailable } from "./ShellNote";

const EXPOSURE_ITEMS = [
	{ value: "direct", label: "Always available" },
	{ value: "deferred", label: "Load when needed" },
	{ value: "codemode", label: "Via code" },
	{ value: "hidden", label: "Hidden" },
];

export function ConnectionDetail({ connectionId }: { connectionId: string }) {
	const connection = useRuntime((s) => s.connections.find((c) => c.id === connectionId));
	const status = useRuntime((s) => s.connectionStatus[connectionId]);
	const dots = useDots((s) => s.dots);
	const [busy, setBusy] = useState<string | undefined>();
	const [confirmRemove, setConfirmRemove] = useState(false);
	const shellOk = useShellAvailable();
	const type = connection?.type;
	const featureKey = connection?.features?.join(",") ?? "";

	// Built-in connections (This Mac, Google, Microsoft) list their tools without starting anything, so refresh on open
	// and whenever their features change. MCP servers are only checked when you press Test.
	useEffect(() => {
		if (type !== "mac" && type !== "google" && type !== "microsoft" && type !== "knowledge") return;
		void featureKey; // re-list when the enabled features change
		api.connections
			.check(connectionId as Connection["id"])
			.then((st) => useRuntime.getState().setConnectionStatus(st))
			.catch(() => undefined);
	}, [connectionId, type, featureKey]);

	if (!connection) {
		return (
			<div className="flex flex-col items-start gap-3">
				<Button variant="ghost" size="sm" onClick={() => navigate("#/connections")}>
					Back to connections
				</Button>
				<p className="text-sm text-fg-2">This connection no longer exists.</p>
			</div>
		);
	}

	const run = async (key: string, fn: () => Promise<unknown>, failTitle: string) => {
		setBusy(key);
		try {
			await fn();
		} catch (e) {
			toast({ title: failTitle, description: errorText(e), variant: "error" });
		} finally {
			setBusy(undefined);
		}
	};

	const check = () =>
		run(
			"check",
			async () => {
				const st = await api.connections.check(connection.id);
				useRuntime.getState().setConnectionStatus(st);
			},
			"Couldn't test the connection",
		);

	const patch = (p: Parameters<typeof api.connections.update>[1], key: string) =>
		run(
			key,
			async () => {
				await api.connections.update(connection.id, p);
				await useRuntime.getState().loadConnections();
			},
			"Couldn't save",
		);

	const isOAuth = connection.type === "google" || connection.type === "microsoft";
	const users = dotsUsing(dots, connection.id);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<Button variant="ghost" size="sm" onClick={() => navigate("#/connections")}>
					Back to connections
				</Button>
			</div>
			<div className="flex items-start gap-4">
				<IconTile name={connection.icon} className="h-12 w-12" />
				<div className="min-w-0 flex-1">
					<h2 className="text-2xl font-semibold text-fg">{connection.label}</h2>
					<p className="text-sm text-fg-2">{connection.description}</p>
					{connection.account && <p className="mt-1 text-sm text-fg-2">Signed in as {connection.account}</p>}
				</div>
				<Switch
					aria-label="Enabled"
					label="Enabled"
					checked={connection.enabled}
					onCheckedChange={(enabled) => void patch({ enabled }, "enable")}
				/>
			</div>

			<section className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-elevated p-4">
				<div className="flex flex-wrap items-center gap-3">
					<ConnectionStatePill connection={connection} />
					{status && <span className="text-sm text-fg-2">{status.toolCount} tools</span>}
					<div className="ml-auto flex gap-2">
						<Button size="sm" variant="secondary" loading={busy === "check"} onClick={check}>
							Test
						</Button>
						<Button size="sm" variant="secondary" loading={busy === "check"} onClick={check}>
							Reconnect
						</Button>
						{(isOAuth || connection.type === "mcp-http") && (
							<OAuthButtons connection={connection} busy={busy} run={run} />
						)}
					</div>
				</div>
				{status?.error && <p className="text-sm text-danger">{status.error}</p>}
				{type === "mac" && !shellOk && connection?.features.includes("shell") && (
					<ShellNote className="text-sm text-warning" />
				)}
				{status?.stderrTail && (
					<pre className="od-selectable max-h-40 overflow-auto whitespace-pre-wrap rounded-sm bg-sunken p-3 font-mono text-xs text-fg-2">
						{status.stderrTail}
					</pre>
				)}
			</section>

			{type === "knowledge" && <KnowledgePanel />}

			<section className="flex flex-col gap-2">
				<h3 className="text-lg font-semibold text-fg">Tools</h3>
				{!status || status.tools.length === 0 ? (
					<p className="text-sm text-fg-3">No tools yet. Test the connection to find them.</p>
				) : (
					<div className="overflow-hidden rounded-lg border border-border-subtle">
						<table className="w-full text-left text-sm">
							<thead className="bg-sunken text-xs text-fg-3">
								<tr>
									<th className="px-3 py-2 font-medium">Name</th>
									<th className="px-3 py-2 font-medium">Description</th>
									<th className="px-3 py-2 font-medium">Type</th>
									<th className="px-3 py-2 font-medium">Exposure</th>
								</tr>
							</thead>
							<tbody>
								{status.tools.map((t) => (
									<tr key={t.name} className="border-t border-border-subtle align-top">
										<td className="px-3 py-2 font-mono text-xs text-fg">{t.name}</td>
										<td className="px-3 py-2 text-fg-2">
											<span className="line-clamp-2">{t.description}</span>
										</td>
										<td className="px-3 py-2">
											<div className="flex gap-1">
												{t.readOnly && <Badge variant="success">Read-only</Badge>}
												{t.destructive && <Badge variant="danger">Destructive</Badge>}
											</div>
										</td>
										<td className="px-3 py-2">
											<Select
												size="sm"
												aria-label={`Exposure for ${t.name}`}
												value={connection.toolExposure[t.name] ?? t.exposure}
												groups={[{ items: EXPOSURE_ITEMS }]}
												onValueChange={(v) =>
													void patch(
														{ toolExposure: { ...connection.toolExposure, [t.name]: v as McpExposure } },
														`exp-${t.name}`,
													)
												}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="flex flex-col gap-2">
				<h3 className="text-lg font-semibold text-fg">Used by</h3>
				{users.length === 0 ? (
					<p className="text-sm text-fg-3">No Dot uses this connection yet.</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{users.map((d) => (
							<button
								key={d.id}
								type="button"
								onClick={() => navigate(`#/chats/${d.id}`)}
								className="flex items-center gap-2 rounded-full bg-active py-1 pl-1 pr-3 text-sm text-fg hover:bg-hover"
							>
								<Avatar
									size="xs"
									icon={d.appearance.icon}
									color={d.appearance.color}
									name={d.name}
									mark={d.kind === "super"}
								/>
								{d.name}
							</button>
						))}
					</div>
				)}
			</section>

			{type !== "knowledge" && (
				<div>
					<Button variant="danger" size="sm" onClick={() => setConfirmRemove(true)}>
						Remove connection
					</Button>
				</div>
			)}
			<Dialog
				open={confirmRemove}
				onOpenChange={setConfirmRemove}
				size="sm"
				title={`Remove ${connection.label}?`}
				description="Dots that use it will lose access to its tools."
				footer={
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirmRemove(false)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							loading={busy === "remove"}
							onClick={() =>
								void run(
									"remove",
									async () => {
										await api.connections.remove(connection.id);
										await useRuntime.getState().loadConnections();
										setConfirmRemove(false);
										navigate("#/connections");
									},
									"Couldn't remove",
								)
							}
						>
							Remove
						</Button>
					</DialogFooter>
				}
			>
				<p className="text-sm text-fg-2">This can't be undone.</p>
			</Dialog>
		</div>
	);
}

function OAuthButtons({
	connection,
	busy,
	run,
}: {
	connection: Connection;
	busy?: string;
	run: (key: string, fn: () => Promise<unknown>, failTitle: string) => Promise<void>;
}) {
	const brand =
		connection.type === "google" ? "Google" : connection.type === "microsoft" ? "Microsoft" : connection.label;
	return connection.account ? (
		<Button
			size="sm"
			variant="secondary"
			loading={busy === "signout"}
			onClick={() =>
				void run(
					"signout",
					async () => {
						await api.connections.signOut(connection.id);
						await useRuntime.getState().loadConnections();
					},
					"Couldn't sign out",
				)
			}
		>
			Sign out
		</Button>
	) : (
		<Button
			size="sm"
			loading={busy === "signin"}
			onClick={() =>
				void run(
					"signin",
					async () => {
						await api.connections.signIn(connection.id);
						await useRuntime.getState().loadConnections();
					},
					"Couldn't sign in",
				)
			}
		>
			Sign in with {brand}
		</Button>
	);
}
