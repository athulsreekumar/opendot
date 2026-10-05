import type { ConnectionStatus, InstallConnectionInput } from "@shared/types";

type CustomInput = Extract<InstallConnectionInput, { custom: unknown }>["custom"];

import { useEffect, useState } from "react";
import { Button, Dialog, DialogFooter, Input, SegmentedControl, TextArea, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";
import { CheckResult } from "./CheckResult";
import { EnvEditor, type EnvRow, splitEnv } from "./EnvEditor";

export function slugify(s: string): string {
	return s
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

export function AddMcpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
	const [type, setType] = useState<"local" | "remote">("local");
	const [label, setLabel] = useState("");
	const [name, setName] = useState("");
	const [nameTouched, setNameTouched] = useState(false);
	const [command, setCommand] = useState("");
	const [args, setArgs] = useState("");
	const [env, setEnv] = useState<EnvRow[]>([]);
	const [url, setUrl] = useState("");
	const [headers, setHeaders] = useState<EnvRow[]>([]);
	const [auth, setAuth] = useState<"none" | "bearer" | "oauth">("none");
	const [token, setToken] = useState("");
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<ConnectionStatus | undefined>();

	useEffect(() => {
		if (!open) {
			setType("local");
			setLabel("");
			setName("");
			setNameTouched(false);
			setCommand("");
			setArgs("");
			setEnv([]);
			setUrl("");
			setHeaders([]);
			setAuth("none");
			setToken("");
			setStatus(undefined);
		}
	}, [open]);

	const valid =
		slugify(name).length > 0 && (type === "local" ? command.trim().length > 0 : /^https?:\/\//.test(url.trim()));

	const submit = async () => {
		setBusy(true);
		setStatus(undefined);
		try {
			const finalName = slugify(name);
			const custom: CustomInput =
				type === "local"
					? (() => {
							const { plain, secret } = splitEnv(env);
							return {
								type: "mcp-stdio" as const,
								name: finalName,
								label: label.trim() || finalName,
								command: command.trim(),
								args: args
									.split("\n")
									.map((a) => a.trim())
									.filter(Boolean),
								env: plain,
								secretEnv: secret,
							};
						})()
					: (() => {
							const { plain, secret } = splitEnv(headers);
							if (auth === "bearer" && token.trim()) secret.Authorization = `Bearer ${token.trim()}`;
							return {
								type: "mcp-http" as const,
								name: finalName,
								label: label.trim() || finalName,
								url: url.trim(),
								headers: plain,
								secretHeaders: secret,
							};
						})();
			const conn =
				custom.type === "mcp-stdio"
					? await api.connections.install({ custom })
					: await api.connections.install({ custom });
			await useRuntime.getState().loadConnections();
			const st = await api.connections.check(conn.id);
			useRuntime.getState().setConnectionStatus(st);
			setStatus(st);
			if (st.state === "connected") toast({ title: `${conn.label} is connected`, variant: "success" });
		} catch (e) {
			toast({ title: "Couldn't add the server", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Add MCP server"
			description="Connect any Model Context Protocol server."
			size="lg"
			footer={
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{status ? "Done" : "Cancel"}
					</Button>
					{!status && (
						<Button onClick={submit} disabled={!valid} loading={busy}>
							Add and test
						</Button>
					)}
				</DialogFooter>
			}
		>
			<div className="flex flex-col gap-4">
				<SegmentedControl
					aria-label="Server type"
					value={type}
					onValueChange={(v) => setType(v as "local" | "remote")}
					options={[
						{ value: "local", label: "Local command" },
						{ value: "remote", label: "Remote URL" },
					]}
				/>
				<div className="grid grid-cols-2 gap-3">
					{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input */}
					<label className="flex flex-col gap-1 text-sm text-fg-2">
						Display name
						<Input
							value={label}
							placeholder="My server"
							onChange={(e) => {
								setLabel(e.target.value);
								if (!nameTouched) setName(slugify(e.target.value));
							}}
						/>
					</label>
					{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input */}
					<label className="flex flex-col gap-1 text-sm text-fg-2">
						Name (used in tool names)
						<Input
							value={name}
							placeholder="my-server"
							className="font-mono"
							onChange={(e) => {
								setNameTouched(true);
								setName(e.target.value);
							}}
						/>
					</label>
				</div>
				{type === "local" ? (
					<>
						{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input */}
						<label className="flex flex-col gap-1 text-sm text-fg-2">
							Command
							<Input
								value={command}
								onChange={(e) => setCommand(e.target.value)}
								placeholder="npx"
								className="font-mono"
							/>
						</label>
						{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input */}
						<label className="flex flex-col gap-1 text-sm text-fg-2">
							Arguments (one per line)
							<TextArea
								value={args}
								onChange={(e) => setArgs(e.target.value)}
								minRows={3}
								maxRows={8}
								placeholder={"-y\n@modelcontextprotocol/server-everything"}
								className="font-mono"
							/>
						</label>
						<div className="flex flex-col gap-1">
							<span className="text-sm text-fg-2">Environment variables</span>
							<EnvEditor rows={env} onChange={setEnv} keyLabel="Variable" addLabel="Add variable" />
						</div>
					</>
				) : (
					<>
						{/* biome-ignore lint/a11y/noLabelWithoutControl: wraps a design-system input */}
						<label className="flex flex-col gap-1 text-sm text-fg-2">
							URL
							<Input
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								placeholder="https://example.com/mcp"
								className="font-mono"
							/>
						</label>
						<div className="flex flex-col gap-1">
							<span className="text-sm text-fg-2">Sign-in</span>
							<SegmentedControl
								aria-label="Authentication"
								value={auth}
								onValueChange={(v) => setAuth(v as "none" | "bearer" | "oauth")}
								options={[
									{ value: "none", label: "None" },
									{ value: "bearer", label: "Bearer token" },
									{ value: "oauth", label: "OAuth" },
								]}
							/>
							{auth === "bearer" && (
								<Input
									aria-label="Bearer token"
									type="password"
									value={token}
									onChange={(e) => setToken(e.target.value)}
									placeholder="Token"
								/>
							)}
							{auth === "oauth" && (
								<p className="text-xs text-fg-3">You will be asked to sign in the first time this server connects.</p>
							)}
						</div>
						<div className="flex flex-col gap-1">
							<span className="text-sm text-fg-2">Headers</span>
							<EnvEditor rows={headers} onChange={setHeaders} keyLabel="Header" addLabel="Add header" />
						</div>
					</>
				)}
				{status && <CheckResult status={status} />}
			</div>
		</Dialog>
	);
}
