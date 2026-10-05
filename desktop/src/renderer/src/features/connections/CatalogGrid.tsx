import type { CatalogCategory, CatalogEntry, Connection, ConnectionStatus } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/design-system/cn";
import { Button, Dialog, DialogFooter, Input, Spinner, Switch, toast } from "@/design-system/components";
import { IconExternal, IconSearch, IconWarning } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";
import { CheckResult } from "./CheckResult";
import { IconTile } from "./ConnectionCard";

const CATEGORY_LABELS: Record<CatalogCategory, string> = {
	productivity: "Productivity",
	dev: "Developer",
	data: "Data",
	files: "Files",
	communication: "Communication",
	knowledge: "Knowledge",
	system: "System",
	other: "Other",
};

export function CatalogGrid() {
	const [entries, setEntries] = useState<CatalogEntry[] | undefined>();
	const [category, setCategory] = useState<CatalogCategory | "all">("all");
	const [query, setQuery] = useState("");
	const [unverified, setUnverified] = useState(false);
	const [installing, setInstalling] = useState<CatalogEntry | undefined>();
	const installed = useRuntime((s) => s.connections);

	useEffect(() => {
		api.connections
			.catalog()
			.then(setEntries)
			.catch((e) => toast({ title: "Couldn't load the catalog", description: errorText(e), variant: "error" }));
	}, []);

	const categories = useMemo(() => [...new Set((entries ?? []).map((e) => e.category))], [entries]);
	const shown = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (entries ?? []).filter(
			(e) =>
				(unverified || e.verified) &&
				(category === "all" || e.category === category) &&
				(!q || `${e.label} ${e.description}`.toLowerCase().includes(q)),
		);
	}, [entries, category, query, unverified]);

	if (!entries) {
		return (
			<div className="flex justify-center py-12">
				<Spinner size={24} />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<div className="w-64">
					<Input
						aria-label="Search the catalog"
						placeholder="Search"
						leading={<IconSearch size={16} />}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{(["all", ...categories] as const).map((c) => (
						<button
							key={c}
							type="button"
							aria-pressed={category === c}
							onClick={() => setCategory(c)}
							className={cn(
								"h-7 rounded-full px-3 text-sm transition-colors",
								category === c ? "bg-accent text-accent-fg" : "bg-active text-fg-2 hover:text-fg",
							)}
						>
							{c === "all" ? "All" : CATEGORY_LABELS[c]}
						</button>
					))}
				</div>
				<div className="ml-auto">
					<Switch label="Show unverified" checked={unverified} onCheckedChange={setUnverified} />
				</div>
			</div>
			{unverified && (
				<div className="flex items-start gap-2 rounded-md bg-warning-subtle p-3 text-sm text-warning">
					<IconWarning size={16} className="mt-0.5 shrink-0" />
					Unverified servers are community-made. They run code on your Mac, so only install ones you trust.
				</div>
			)}
			{shown.length === 0 ? (
				<p className="py-12 text-center text-sm text-fg-3">Nothing matches. Try a different search.</p>
			) : (
				<div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[1100px]:grid-cols-3">
					{shown.map((e) => {
						const isInstalled = installed.some((c) => c.catalogId === e.id);
						return (
							<div key={e.id} className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-elevated p-4">
								<div className="flex items-start gap-3">
									<IconTile name={e.icon} />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate text-md font-semibold text-fg">{e.label}</span>
											{!e.verified && (
												<span className="rounded-sm bg-warning-subtle px-1.5 text-2xs text-warning">Unverified</span>
											)}
										</div>
										<p className="line-clamp-2 text-sm text-fg-2">{e.description}</p>
									</div>
								</div>
								<div className="flex justify-end">
									<Button size="sm" variant={isInstalled ? "secondary" : "primary"} onClick={() => setInstalling(e)}>
										{isInstalled ? "Install again" : "Install"}
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			)}
			{installing && <InstallDialog entry={installing} onClose={() => setInstalling(undefined)} />}
		</div>
	);
}

function InstallDialog({ entry, onClose }: { entry: CatalogEntry; onClose: () => void }) {
	const [values, setValues] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState<"test" | "install" | undefined>();
	const [conn, setConn] = useState<Connection | undefined>();
	const [status, setStatus] = useState<ConnectionStatus | undefined>();
	const [tools, setTools] = useState<{ node?: string; npx: boolean; uvx: boolean } | undefined>();

	useEffect(() => {
		if (entry.requiresNode || entry.requiresUv) {
			api.connections
				.nodeAvailable()
				.then(setTools)
				.catch(() => {});
		}
	}, [entry]);

	const missing = tools && ((entry.requiresNode && !tools.npx) || (entry.requiresUv && !tools.uvx));

	const ensureInstalled = async (): Promise<Connection> => {
		if (conn) return conn;
		const c = await api.connections.install({ catalogId: entry.id, inputs: values });
		setConn(c);
		await useRuntime.getState().loadConnections();
		return c;
	};

	const test = async () => {
		setBusy("test");
		try {
			const c = await ensureInstalled();
			const st = await api.connections.check(c.id);
			useRuntime.getState().setConnectionStatus(st);
			setStatus(st);
		} catch (e) {
			toast({ title: "Test failed", description: errorText(e), variant: "error" });
		} finally {
			setBusy(undefined);
		}
	};

	const install = async () => {
		setBusy("install");
		try {
			await ensureInstalled();
			toast({ title: `${entry.label} installed`, variant: "success" });
			onClose();
		} catch (e) {
			toast({ title: "Couldn't install", description: errorText(e), variant: "error" });
		} finally {
			setBusy(undefined);
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(o) => !o && onClose()}
			title={`Install ${entry.label}`}
			description={entry.description}
			footer={
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="secondary" onClick={test} loading={busy === "test"} disabled={!!busy}>
						Test connection
					</Button>
					<Button onClick={install} loading={busy === "install"} disabled={!!busy}>
						{conn ? "Done" : "Install"}
					</Button>
				</DialogFooter>
			}
		>
			<div className="flex flex-col gap-4">
				{missing && (
					<div className="flex items-start gap-2 rounded-md bg-warning-subtle p-3 text-sm text-warning">
						<IconWarning size={16} className="mt-0.5 shrink-0" />
						{entry.requiresUv && !tools?.uvx
							? "This server needs uv, which isn't installed on this Mac."
							: "This server needs Node.js, which isn't installed on this Mac."}{" "}
						You can still install it, but it won't connect until that is available.
					</div>
				)}
				{entry.inputs.length === 0 && <p className="text-sm text-fg-2">Nothing to fill in. It's ready to install.</p>}
				{entry.inputs.map((i) => (
					// biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input
					<label key={i.key} className="flex flex-col gap-1 text-sm text-fg-2">
						{i.label}
						<Input
							type={i.secret ? "password" : "text"}
							autoComplete="off"
							placeholder={i.placeholder}
							value={values[i.key] ?? ""}
							onChange={(e) => setValues((v) => ({ ...v, [i.key]: e.target.value }))}
						/>
						{i.help && <span className="text-xs text-fg-3">{i.help}</span>}
					</label>
				))}
				{entry.docsUrl && (
					<button
						type="button"
						className="inline-flex items-center gap-1 self-start text-sm text-link hover:underline"
						onClick={() => entry.docsUrl && void api.app.openExternal(entry.docsUrl)}
					>
						Documentation <IconExternal size={14} />
					</button>
				)}
				{status && <CheckResult status={status} />}
			</div>
		</Dialog>
	);
}
