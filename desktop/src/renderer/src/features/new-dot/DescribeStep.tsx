import { resolveDotIcon } from "@shared/dot-icons";
import type { ConnectorChoice, DotColor, DotDraft, DotTemplate } from "@shared/types";
import { DOT_COLORS } from "@shared/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/design-system/cn";
import { Avatar, Button, Input, Menu, MenuContent, MenuItem, MenuTrigger, TextArea } from "@/design-system/components";
import { DotIcon } from "@/design-system/dot-icon-map";
import { IconCheck, IconSearch, IconSparkles } from "@/design-system/icons";
import { ConnectionIcon } from "@/features/connections/ConnectionCard";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { mapSuggestedConnections } from "./connectors";
import { parsePartialJson } from "./partial-json";

export const PROMPT_MIN = 10;
export const PROMPT_MAX = 2000;
const PLACEHOLDER = "Watch my inbox for client emails, summarise them every morning and draft replies in my tone.";

export interface DescribeResult {
	draft: DotDraft;
	prompt: string;
	connectors: ConnectorChoice[];
}

interface Preview {
	name?: string;
	icon?: string;
	tagline?: string;
	role?: string;
	color?: DotColor;
}

function toPreview(o: Record<string, unknown>): Preview {
	const str = (v: unknown) => (typeof v === "string" ? v : undefined);
	const color = str(o.color);
	return {
		name: str(o.name),
		icon: str(o.icon) ?? str(o.emoji),
		tagline: str(o.tagline),
		role: str(o.role),
		color: DOT_COLORS.find((c) => c === color),
	};
}

function newRequestId(): string {
	return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function TypingDots() {
	return (
		<span className="inline-flex gap-0.5 align-middle" aria-hidden="true">
			{["", "[animation-delay:150ms]", "[animation-delay:300ms]"].map((delay) => (
				<span key={delay} className={cn("h-1 w-1 rounded-full bg-fg-3 animate-pulse", delay)} />
			))}
		</span>
	);
}

export function DescribeStep({
	initialPrompt = "",
	initialConnectors = [],
	onDraft,
	onCancel,
}: {
	initialPrompt?: string;
	initialConnectors?: ConnectorChoice[];
	onDraft: (r: DescribeResult) => void;
	onCancel?: () => void;
}) {
	const [prompt, setPrompt] = useState(initialPrompt);
	const [touched, setTouched] = useState(false);
	const [selected, setSelected] = useState<Record<string, ConnectorChoice>>(() =>
		Object.fromEntries(initialConnectors.map((c) => [c.id, c])),
	);
	const [templates, setTemplates] = useState<DotTemplate[]>([]);
	const [choices, setChoices] = useState<ConnectorChoice[]>([]);
	const [search, setSearch] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const [preview, setPreview] = useState<Preview>({});
	const defaultModel = useSettings((s) => s.settings?.defaultModel);
	const alive = useRef(true);

	useEffect(() => {
		alive.current = true;
		void api.dots
			.templates()
			.then((t) => alive.current && setTemplates(t))
			.catch(() => undefined);
		void api.dots
			.connectorChoices()
			.then((c) => alive.current && setChoices(c))
			.catch(() => undefined);
		return () => {
			alive.current = false;
		};
	}, []);

	const trimmed = prompt.trim();
	const tooShort = trimmed.length < PROMPT_MIN;
	const valid = !tooShort && trimmed.length <= PROMPT_MAX;

	const applyTemplate = (t: DotTemplate) => {
		setPrompt(t.examplePrompt);
		const mapped = mapSuggestedConnections(t.draft.suggestedConnections, choices);
		setSelected(Object.fromEntries(mapped.map((c) => [c.id, c])));
		setError(undefined);
	};

	const toggle = (c: ConnectorChoice) =>
		setSelected((s) => {
			const next = { ...s };
			if (next[c.id]) delete next[c.id];
			else next[c.id] = c;
			return next;
		});

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return q ? choices.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)) : choices;
	}, [choices, search]);
	const installed = filtered.filter((c) => c.kind === "installed");
	const available = filtered.filter((c) => c.kind === "available");

	const generate = async () => {
		setTouched(true);
		if (!valid || busy) return;
		setBusy(true);
		setError(undefined);
		setPreview({});
		const requestId = newRequestId();
		let acc = "";
		const off = api.on("dots:draft-stream", (p) => {
			if (p.requestId !== requestId || !alive.current) return;
			acc += p.delta;
			const parsed = parsePartialJson(acc);
			if (parsed) setPreview((prev) => ({ ...prev, ...toPreview(parsed) }));
		});
		const connectors = Object.values(selected);
		try {
			const draft = await api.dots.draftFromDescription({ prompt: trimmed, connectors }, requestId);
			if (alive.current) onDraft({ draft, prompt: trimmed, connectors });
		} catch (e) {
			if (alive.current) setError(errorText(e));
		} finally {
			off();
			if (alive.current) setBusy(false);
		}
	};

	const chips = templates.slice(0, 5);

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<label htmlFor="newdot-prompt" className="text-md font-medium text-fg">
					What should this Dot do?
				</label>
				<TextArea
					id="newdot-prompt"
					autoGrow
					minRows={4}
					maxRows={10}
					maxLength={PROMPT_MAX}
					showCount
					value={prompt}
					placeholder={PLACEHOLDER}
					disabled={busy}
					aria-invalid={touched && !valid}
					onChange={(e) => setPrompt(e.target.value)}
					onBlur={() => setTouched(true)}
				/>
				{touched && tooShort && (
					<p className="text-sm text-danger" role="alert">
						Describe what it should do in at least {PROMPT_MIN} characters.
					</p>
				)}
				{chips.length > 0 && (
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="text-xs text-fg-3">Try an example:</span>
						{chips.map((t) => (
							<button
								key={t.id}
								type="button"
								title={t.examplePrompt}
								disabled={busy}
								onClick={() => applyTemplate(t)}
								className="inline-flex h-7 items-center rounded-full border border-border-subtle bg-elevated px-3 text-sm text-fg hover:bg-hover disabled:opacity-50"
							>
								<DotIcon name={t.draft.appearance.icon} size={14} className="mr-1.5" /> {t.name}
							</button>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<span className="text-md font-medium text-fg">Connectors it can use (optional)</span>
					<div className="w-48">
						<Input
							aria-label="Search connectors"
							placeholder="Search"
							leading={<IconSearch size={14} />}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
				</div>
				<ConnectorGroup title="Installed" items={installed} selected={selected} onToggle={toggle} disabled={busy} />
				<ConnectorGroup
					title="Available"
					hint="Not set up yet. You can connect them after creating the Dot."
					items={available}
					selected={selected}
					onToggle={toggle}
					disabled={busy}
				/>
				{choices.length > 0 && filtered.length === 0 && (
					<p className="text-sm text-fg-3">No connectors match "{search}".</p>
				)}
			</div>

			{busy && <PreviewCard preview={preview} />}
			{error && (
				<div className="flex items-center justify-between gap-3 rounded-md bg-danger-subtle px-3 py-2" role="alert">
					<p className="text-sm text-danger">{error}</p>
					<Button size="sm" variant="secondary" onClick={() => void generate()}>
						Try again
					</Button>
				</div>
			)}
			{!defaultModel && <p className="text-sm text-fg-2">Add a model to generate a personality.</p>}

			<div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-4">
				<Menu>
					<MenuTrigger asChild>
						<Button variant="link" disabled={busy || templates.length === 0}>
							Browse templates
						</Button>
					</MenuTrigger>
					<MenuContent align="start">
						{templates.map((t) => (
							<MenuItem key={t.id} onSelect={() => applyTemplate(t)}>
								<DotIcon name={t.draft.appearance.icon} size={14} className="mr-2 inline" /> {t.name} · {t.description}
							</MenuItem>
						))}
					</MenuContent>
				</Menu>
				<div className="flex items-center gap-2">
					{onCancel && (
						<Button variant="ghost" onClick={onCancel} disabled={busy}>
							Cancel
						</Button>
					)}
					<Button
						variant="primary"
						loading={busy}
						disabled={touched && !valid}
						leadingIcon={<IconSparkles size={16} />}
						onClick={() => void generate()}
					>
						Create personality
					</Button>
				</div>
			</div>
		</div>
	);
}

function ConnectorGroup({
	title,
	hint,
	items,
	selected,
	onToggle,
	disabled,
}: {
	title: string;
	hint?: string;
	items: ConnectorChoice[];
	selected: Record<string, ConnectorChoice>;
	onToggle: (c: ConnectorChoice) => void;
	disabled?: boolean;
}) {
	if (items.length === 0) return null;
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-baseline gap-2">
				<span className="text-xs font-medium uppercase text-fg-3">{title}</span>
				{hint && <span className="text-xs text-fg-3">{hint}</span>}
			</div>
			<div className="flex flex-wrap gap-1.5">
				{items.map((c) => {
					const on = Boolean(selected[c.id]);
					return (
						<button
							key={c.id}
							type="button"
							aria-pressed={on}
							disabled={disabled}
							onClick={() => onToggle(c)}
							className={cn(
								"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:opacity-50",
								on
									? "border-accent bg-accent-subtle text-accent"
									: "border-border-subtle bg-elevated text-fg hover:bg-hover",
							)}
						>
							<ConnectionIcon name={c.icon} size={14} />
							{c.label}
							{on && <IconCheck size={14} />}
							{!on && c.kind === "available" && <span className="text-2xs text-fg-3">set up later</span>}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function PreviewCard({ preview }: { preview: Preview }) {
	return (
		<div className="flex gap-3 rounded-lg border border-border-subtle bg-sunken p-3" aria-live="polite">
			<Avatar
				size="lg"
				name={preview.name ?? "New Dot"}
				icon={resolveDotIcon({ icon: preview.icon })}
				color={preview.color ?? "teal"}
			/>
			<div className="min-w-0 flex-1">
				<div className="text-lg font-semibold text-fg">{preview.name ?? <TypingDots />}</div>
				<div className="text-sm text-fg-2">{preview.tagline ?? (preview.name ? <TypingDots /> : "")}</div>
				{preview.role !== undefined && (
					<p className="mt-1 line-clamp-3 text-sm text-fg-2">
						{preview.role} <TypingDots />
					</p>
				)}
			</div>
		</div>
	);
}
