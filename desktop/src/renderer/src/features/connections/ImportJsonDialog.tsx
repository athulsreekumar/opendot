import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogFooter, Input, TextArea, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";

export interface ParsedServer {
	name: string;
	kind: "stdio" | "http";
	summary: string;
	config: Record<string, unknown>;
}

export interface ParsedMcpJson {
	servers: ParsedServer[];
	warnings: string[];
	error?: string;
	/** A single server object that still needs a name. */
	needsName?: boolean;
}

function isObj(v: unknown): v is Record<string, unknown> {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function describe(name: string, cfg: Record<string, unknown>, warnings: string[]): ParsedServer | undefined {
	const url = typeof cfg.url === "string" ? cfg.url : typeof cfg.serverUrl === "string" ? cfg.serverUrl : undefined;
	const command = typeof cfg.command === "string" ? cfg.command : undefined;
	if (!command && !url) {
		warnings.push(`"${name}" has no command or URL and will be skipped.`);
		return undefined;
	}
	if (JSON.stringify(cfg).includes("${input:"))
		warnings.push(`"${name}" needs a value you will have to fill in afterwards.`);
	if (command) {
		const args = Array.isArray(cfg.args) ? cfg.args.map(String).join(" ") : "";
		return { name, kind: "stdio", summary: `${command} ${args}`.trim(), config: cfg };
	}
	return { name, kind: "http", summary: url ?? "", config: cfg };
}

/** Parse Claude Desktop / Cursor (`mcpServers`), VS Code (`servers`) or a single server object. */
export function parseMcpJson(text: string): ParsedMcpJson {
	const trimmed = text.trim();
	if (!trimmed) return { servers: [], warnings: [] };
	let data: unknown;
	try {
		data = JSON.parse(trimmed);
	} catch {
		return { servers: [], warnings: [], error: "That doesn't look like valid JSON yet." };
	}
	if (!isObj(data)) return { servers: [], warnings: [], error: "Expected a JSON object." };
	const warnings: string[] = [];
	const map = isObj(data.mcpServers) ? data.mcpServers : isObj(data.servers) ? data.servers : undefined;
	const servers: ParsedServer[] = [];
	if (map) {
		for (const [name, cfg] of Object.entries(map)) {
			if (!isObj(cfg)) {
				warnings.push(`"${name}" is not a server object and will be skipped.`);
				continue;
			}
			const s = describe(name, cfg, warnings);
			if (s) servers.push(s);
		}
	} else if (typeof data.command === "string" || typeof data.url === "string") {
		const s = describe("", data, warnings);
		if (s) servers.push(s);
		return { servers, warnings, needsName: true };
	} else {
		return { servers: [], warnings, error: "No mcpServers found in this JSON." };
	}
	if (servers.length === 0 && warnings.length === 0) warnings.push("No servers found.");
	return { servers, warnings };
}

export function ImportJsonDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
	const [text, setText] = useState("");
	const [single, setSingle] = useState("");
	const [picked, setPicked] = useState<Record<string, boolean>>({});
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<{ added: string[]; errors: string[] } | undefined>();
	const parsed = useMemo(() => parseMcpJson(text), [text]);

	useEffect(() => {
		if (!open) {
			setText("");
			setSingle("");
			setPicked({});
			setResult(undefined);
		}
	}, [open]);

	useEffect(() => {
		setPicked(Object.fromEntries(parsed.servers.map((s) => [s.name, true])));
	}, [parsed]);

	const selected = parsed.servers.filter((s) => picked[s.name] !== false);
	const canImport = selected.length > 0 && (!parsed.needsName || single.trim().length > 0) && !busy;

	const doImport = async () => {
		setBusy(true);
		try {
			const entries = Object.fromEntries(selected.map((s) => [parsed.needsName ? single.trim() : s.name, s.config]));
			const r = await api.connections.importJson(JSON.stringify({ mcpServers: entries }));
			setResult({ added: r.added.map((c) => c.label), errors: r.errors });
			await useRuntime.getState().loadConnections();
			if (r.errors.length === 0)
				toast({ title: `Added ${r.added.length} ${r.added.length === 1 ? "server" : "servers"}` });
		} catch (e) {
			toast({ title: "Couldn't import", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Import from JSON"
			description="Paste your mcpServers JSON (Claude Desktop, Cursor, VS Code)."
			size="lg"
			footer={
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{result ? "Done" : "Cancel"}
					</Button>
					{!result && (
						<Button onClick={doImport} disabled={!canImport} loading={busy}>
							Import
						</Button>
					)}
				</DialogFooter>
			}
		>
			<div className="flex flex-col gap-4">
				<TextArea
					aria-label="mcpServers JSON"
					placeholder={'{ "mcpServers": { "github": { "command": "npx", "args": ["-y", "..."] } } }'}
					value={text}
					onChange={(e) => setText(e.target.value)}
					minRows={6}
					maxRows={12}
					className="font-mono"
				/>
				{parsed.error && <p className="text-sm text-danger">{parsed.error}</p>}
				{parsed.needsName && (
					// biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input
					<label className="flex flex-col gap-1 text-sm text-fg-2">
						Name for this server
						<Input value={single} onChange={(e) => setSingle(e.target.value)} placeholder="my-server" />
					</label>
				)}
				{parsed.servers.length > 0 && (
					<div className="flex flex-col gap-1">
						<div className="text-sm font-medium text-fg">
							Found {parsed.servers.length} {parsed.servers.length === 1 ? "server" : "servers"}
						</div>
						{parsed.servers.map((s) => (
							<label
								key={s.name || "single"}
								className="flex items-center gap-3 rounded-md border border-border-subtle bg-sunken px-3 py-2"
							>
								<input
									type="checkbox"
									checked={picked[s.name] !== false}
									onChange={(e) => setPicked((p) => ({ ...p, [s.name]: e.target.checked }))}
									aria-label={`Import ${s.name || "server"}`}
								/>
								<span className="text-sm font-medium text-fg">{s.name || "(unnamed)"}</span>
								<span className="rounded-sm bg-active px-1.5 text-2xs text-fg-2">
									{s.kind === "stdio" ? "Local" : "Remote"}
								</span>
								<span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-3">{s.summary}</span>
							</label>
						))}
					</div>
				)}
				{parsed.warnings.length > 0 && (
					<ul className="flex flex-col gap-1 rounded-md bg-warning-subtle p-3 text-sm text-warning">
						{parsed.warnings.map((w) => (
							<li key={w}>{w}</li>
						))}
					</ul>
				)}
				{result && (
					<div className="flex flex-col gap-1 text-sm">
						{result.added.length > 0 && <p className="text-success">Added: {result.added.join(", ")}</p>}
						{result.errors.map((e) => (
							<p key={e} className="text-danger">
								{e}
							</p>
						))}
					</div>
				)}
			</div>
		</Dialog>
	);
}
