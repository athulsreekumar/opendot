import type { AddProviderInput, ProviderSettings, SelfHostedPreset, WireApi } from "@shared/types";
import { useEffect, useState } from "react";
import {
	Button,
	Dialog,
	IconButton,
	Input,
	Select,
	Spinner,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	TextArea,
	toast,
} from "@/design-system/components";
import { IconClose, IconExternal, IconEye, IconEyeOff, IconPlus } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { Field } from "./parts";

type Builtin = { id: string; label: string; keyUrl?: string; featured: boolean };
type Detected = { preset: SelfHostedPreset; baseUrl: string };

const PRESET_LABELS: Record<SelfHostedPreset, string> = {
	ollama: "Ollama",
	lmstudio: "LM Studio",
	llamacpp: "llama.cpp",
	vllm: "vLLM",
};
const PRESET_URLS: Record<SelfHostedPreset, string> = {
	ollama: "http://localhost:11434/v1",
	lmstudio: "http://localhost:1234/v1",
	llamacpp: "http://localhost:8080/v1",
	vllm: "http://localhost:8000/v1",
};

/** Shared by the dialog and onboarding. Calls addProvider, refreshes models, toasts. */
export function useAddProvider(onAdded?: (p: ProviderSettings) => void) {
	const refreshModels = useSettings((s) => s.refreshModels);
	const [busy, setBusy] = useState(false);
	const add = async (input: AddProviderInput) => {
		setBusy(true);
		try {
			const p = await api.models.addProvider(input);
			await refreshModels();
			toast({ title: `${p.label} added`, variant: "success" });
			onAdded?.(p);
		} catch (e) {
			toast({ title: "Couldn't add provider", description: errorText(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};
	return { add, busy };
}

export type FormTab = "cloud" | "local" | "custom";

export function AddProviderForm({
	onAdded,
	tabs = ["cloud", "local", "custom"],
}: {
	onAdded?: (p: ProviderSettings) => void;
	tabs?: FormTab[];
}) {
	const { add, busy } = useAddProvider(onAdded);
	const [tab, setTab] = useState<FormTab>(tabs[0] ?? "cloud");
	return (
		<Tabs value={tab} onValueChange={(v) => setTab(v as FormTab)}>
			<TabsList>
				{tabs.includes("cloud") && <TabsTrigger value="cloud">Cloud</TabsTrigger>}
				{tabs.includes("local") && <TabsTrigger value="local">On this computer</TabsTrigger>}
				{tabs.includes("custom") && <TabsTrigger value="custom">Custom URL</TabsTrigger>}
			</TabsList>
			<TabsContent value="cloud">
				<CloudTab add={add} busy={busy} />
			</TabsContent>
			<TabsContent value="local">
				<LocalTab add={add} busy={busy} />
			</TabsContent>
			<TabsContent value="custom">
				<CustomTab add={add} busy={busy} />
			</TabsContent>
		</Tabs>
	);
}

interface TabProps {
	add: (i: AddProviderInput) => Promise<void>;
	busy: boolean;
}

function CloudTab({ add, busy }: TabProps) {
	const [providers, setProviders] = useState<Builtin[]>([]);
	const [providerId, setProviderId] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [reveal, setReveal] = useState(false);

	useEffect(() => {
		api.models
			.builtinProviders()
			.then((list) => {
				setProviders(list);
				setProviderId((cur) => cur || (list.find((p) => p.featured) ?? list[0])?.id || "");
			})
			.catch(() => undefined);
	}, []);

	const selected = providers.find((p) => p.id === providerId);
	const featured = providers.filter((p) => p.featured);
	const more = providers.filter((p) => !p.featured);

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (providerId && apiKey.trim())
					void add({ kind: "cloud", builtinProviderId: providerId, apiKey: apiKey.trim() });
			}}
		>
			<Field label="Provider">
				<Select
					aria-label="Provider"
					value={providerId}
					onValueChange={(v) => v && setProviderId(v)}
					placeholder="Choose a provider"
					groups={[
						{ items: featured.map((p) => ({ value: p.id, label: p.label })) },
						...(more.length
							? [{ label: "More providers", items: more.map((p) => ({ value: p.id, label: p.label })) }]
							: []),
					]}
				/>
			</Field>
			<Field label="API key">
				<Input
					type={reveal ? "text" : "password"}
					autoComplete="off"
					spellCheck={false}
					placeholder="Paste your key"
					value={apiKey}
					onChange={(e) => setApiKey(e.target.value)}
					trailing={
						<IconButton
							type="button"
							size="sm"
							label={reveal ? "Hide key" : "Show key"}
							icon={reveal ? <IconEyeOff size={14} /> : <IconEye size={14} />}
							onClick={() => setReveal((r) => !r)}
						/>
					}
				/>
			</Field>
			<div className="flex items-center justify-between">
				{selected?.keyUrl ? (
					<Button
						type="button"
						variant="link"
						size="sm"
						trailingIcon={<IconExternal size={12} />}
						onClick={() => selected.keyUrl && void api.app.openExternal(selected.keyUrl)}
					>
						Get a key
					</Button>
				) : (
					<span />
				)}
				<Button type="submit" loading={busy} disabled={!providerId || !apiKey.trim()}>
					Add provider
				</Button>
			</div>
		</form>
	);
}

function LocalTab({ add, busy }: TabProps) {
	const [found, setFound] = useState<Detected[] | undefined>();
	const [preset, setPreset] = useState<SelfHostedPreset>("ollama");
	const [baseUrl, setBaseUrl] = useState(PRESET_URLS.ollama);
	const [apiKey, setApiKey] = useState("");

	useEffect(() => {
		api.models
			.detectLocal()
			.then(setFound)
			.catch(() => setFound([]));
	}, []);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<span className="text-sm font-medium text-fg">Found on this computer</span>
				{!found ? (
					<Spinner />
				) : found.length === 0 ? (
					<p className="text-sm text-fg-3">No local servers found. Start Ollama or LM Studio, or add one below.</p>
				) : (
					found.map((d) => (
						<button
							key={d.preset}
							type="button"
							disabled={busy}
							onClick={() => void add({ kind: "self-hosted", preset: d.preset, baseUrl: d.baseUrl })}
							className="flex items-center justify-between rounded-lg border border-border-subtle bg-sunken px-3 py-2 text-left hover:bg-hover disabled:opacity-50"
						>
							<span>
								<span className="block text-md font-medium text-fg">{PRESET_LABELS[d.preset]}</span>
								<span className="block text-xs text-fg-3">{d.baseUrl}</span>
							</span>
							<IconPlus size={16} className="text-fg-2" />
						</button>
					))
				)}
			</div>
			<form
				className="flex flex-col gap-3 border-t border-border-subtle pt-4"
				onSubmit={(e) => {
					e.preventDefault();
					if (baseUrl.trim())
						void add({ kind: "self-hosted", preset, baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined });
				}}
			>
				<span className="text-sm font-medium text-fg">Add manually</span>
				<Select
					aria-label="Server type"
					value={preset}
					onValueChange={(v) => {
						setPreset(v as SelfHostedPreset);
						setBaseUrl(PRESET_URLS[v as SelfHostedPreset]);
					}}
					groups={[
						{
							items: (Object.keys(PRESET_LABELS) as SelfHostedPreset[]).map((p) => ({
								value: p,
								label: PRESET_LABELS[p],
							})),
						},
					]}
				/>
				<Field label="Server address">
					<Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
				</Field>
				<Field label="API key (optional)">
					<Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
				</Field>
				<div className="flex justify-end">
					<Button type="submit" loading={busy} disabled={!baseUrl.trim()}>
						Add server
					</Button>
				</div>
			</form>
		</div>
	);
}

function CustomTab({ add, busy }: TabProps) {
	const [label, setLabel] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [wire, setWire] = useState<WireApi>("openai-completions");
	const [apiKey, setApiKey] = useState("");
	const [headers, setHeaders] = useState<Array<{ k: string; v: string }>>([]);
	const [models, setModels] = useState("");

	const submit = () => {
		const hdrs: Record<string, string> = {};
		for (const h of headers) if (h.k.trim()) hdrs[h.k.trim()] = h.v;
		const ids = models
			.split(/[\n,]/)
			.map((m) => m.trim())
			.filter(Boolean);
		void add({
			kind: "custom-url",
			label: label.trim(),
			baseUrl: baseUrl.trim(),
			api: wire,
			apiKey: apiKey.trim() || undefined,
			headers: Object.keys(hdrs).length ? hdrs : undefined,
			models: ids.length ? ids : undefined,
		});
	};

	return (
		<form
			className="flex flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				if (label.trim() && baseUrl.trim()) submit();
			}}
		>
			<Field label="Name">
				<Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My company gateway" />
			</Field>
			<Field label="Base URL">
				<Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
			</Field>
			<Field label="API type">
				<Select
					aria-label="API type"
					value={wire}
					onValueChange={(v) => setWire(v as WireApi)}
					groups={[
						{
							items: [
								{ value: "openai-completions", label: "OpenAI-compatible chat" },
								{ value: "openai-responses", label: "OpenAI Responses" },
								{ value: "anthropic-messages", label: "Anthropic-compatible" },
							],
						},
					]}
				/>
			</Field>
			<Field label="API key (optional)">
				<Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
			</Field>
			<div className="flex flex-col gap-2">
				<span className="text-sm font-medium text-fg">Extra headers</span>
				{headers.map((h, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: editable rows without ids
					<div key={i} className="flex items-center gap-2">
						<Input
							aria-label="Header name"
							placeholder="Name"
							value={h.k}
							onChange={(e) => setHeaders((hs) => hs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
						/>
						<Input
							aria-label="Header value"
							placeholder="Value"
							value={h.v}
							onChange={(e) => setHeaders((hs) => hs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
						/>
						<IconButton
							type="button"
							size="sm"
							label="Remove header"
							icon={<IconClose size={14} />}
							onClick={() => setHeaders((hs) => hs.filter((_, j) => j !== i))}
						/>
					</div>
				))}
				<div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						leadingIcon={<IconPlus size={14} />}
						onClick={() => setHeaders((hs) => [...hs, { k: "", v: "" }])}
					>
						Add header
					</Button>
				</div>
			</div>
			<Field label="Model IDs" hint="One per line. Leave empty to discover them after adding.">
				<TextArea minRows={3} value={models} onChange={(e) => setModels(e.target.value)} />
			</Field>
			<div className="flex justify-end">
				<Button type="submit" loading={busy} disabled={!label.trim() || !baseUrl.trim()}>
					Add provider
				</Button>
			</div>
		</form>
	);
}

export function AddProviderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			size="md"
			title="Add a provider"
			description="Connect a model to power your Dots."
		>
			<AddProviderForm onAdded={() => onOpenChange(false)} />
		</Dialog>
	);
}
