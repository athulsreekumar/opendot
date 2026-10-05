import { PII_TYPES, type PiiSettings, type PiiType } from "@shared/types";
import { type ReactNode, useEffect, useState } from "react";
import { Button, IconButton, Input, Select, Switch, TextArea, toast } from "@/design-system/components";
import { IconClose } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";
import { Card, Section } from "./parts";

const TYPE_LABELS: Record<PiiType, string> = {
	EMAIL: "Email addresses",
	PHONE: "Phone numbers",
	CARD: "Card numbers",
	IBAN: "Bank accounts (IBAN)",
	SSN: "Social security numbers",
	IP: "IP addresses",
	SECRET: "API keys and tokens",
	PERSON: "Names",
	ADDRESS: "Street addresses",
	CUSTOM: "Your own terms",
	URL_CRED: "Passwords in links",
};

type Preview = { redacted: string; items: Array<{ type: PiiType; start: number; end: number }> };

export function highlight(text: string, items: Preview["items"]): ReactNode[] {
	const out: ReactNode[] = [];
	let pos = 0;
	for (const it of [...items].sort((a, b) => a.start - b.start)) {
		if (it.start < pos) continue;
		if (it.start > pos) out.push(text.slice(pos, it.start));
		out.push(
			<mark key={`${it.start}-${it.end}`} title={it.type} className="rounded-sm bg-warning-subtle text-warning px-0.5">
				{text.slice(it.start, it.end)}
			</mark>,
		);
		pos = it.end;
	}
	if (pos < text.length) out.push(text.slice(pos));
	return out;
}

export function PrivacySettings() {
	const settings = useSettings((s) => s.settings);
	const update = useSettings((s) => s.update);
	const [term, setTerm] = useState("");
	const [termType, setTermType] = useState<PiiSettings["customTerms"][number]["type"]>("PERSON");
	const [sample, setSample] = useState("Email jane.doe@example.com or call +1 415-555-2671. Card 4111 1111 1111 1111.");
	const [preview, setPreview] = useState<Preview | undefined>();
	const pii = settings?.pii;

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the rules change
	useEffect(() => {
		if (!sample.trim()) {
			setPreview(undefined);
			return;
		}
		let stale = false;
		const t = setTimeout(() => {
			api.pii
				.preview(sample)
				.then((p) => {
					if (!stale) setPreview(p);
				})
				.catch(() => undefined);
		}, 300);
		return () => {
			stale = true;
			clearTimeout(t);
		};
	}, [sample, pii]);

	if (!settings || !pii) return null;
	const save = (patch: Partial<PiiSettings>) =>
		update({ pii: { ...pii, ...patch } }).catch((e) =>
			toast({ title: "Couldn't save", description: errorText(e), variant: "error" }),
		);
	const toggleType = (t: PiiType, on: boolean) =>
		save({ enabledTypes: on ? [...pii.enabledTypes, t] : pii.enabledTypes.filter((x) => x !== t) });
	const addTerm = () => {
		const v = term.trim();
		if (!v || pii.customTerms.some((c) => c.term.toLowerCase() === v.toLowerCase())) return;
		void save({ customTerms: [...pii.customTerms, { term: v, type: termType }] });
		setTerm("");
	};

	return (
		<div className="flex flex-col gap-8">
			<Section
				title="What to mask"
				description="Personal details are replaced with placeholders before a message reaches a cloud model."
			>
				<Card>
					<div className="grid grid-cols-2 gap-2">
						{PII_TYPES.filter((t) => t !== "CUSTOM").map((t) => (
							<label key={t} className="flex items-center gap-2 text-md text-fg cursor-pointer">
								<input
									type="checkbox"
									checked={pii.enabledTypes.includes(t)}
									onChange={(e) => toggleType(t, e.target.checked)}
								/>
								{TYPE_LABELS[t]}
							</label>
						))}
					</div>
					<Switch
						label="Detect names (experimental)"
						description="Looks for people's names in your text. It can miss some or flag ordinary words."
						checked={pii.detectNames}
						onCheckedChange={(v) => save({ detectNames: v })}
					/>
				</Card>
			</Section>
			<Section title="Your own terms" description="Always masked, whatever the type settings.">
				<Card>
					<div className="flex gap-2 items-center">
						<Input
							aria-label="Term to mask"
							placeholder="A name, project or address"
							value={term}
							onChange={(e) => setTerm(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") addTerm();
							}}
						/>
						<Select
							aria-label="Term type"
							value={termType}
							onValueChange={(v) => setTermType(v as typeof termType)}
							groups={[
								{
									items: [
										{ value: "PERSON", label: "Name" },
										{ value: "ADDRESS", label: "Address" },
										{ value: "CUSTOM", label: "Other" },
									],
								},
							]}
						/>
						<Button variant="secondary" onClick={addTerm} disabled={!term.trim()}>
							Add
						</Button>
					</div>
					{pii.customTerms.length > 0 && (
						<ul className="flex flex-col gap-1">
							{pii.customTerms.map((c) => (
								<li key={`${c.type}:${c.term}`} className="flex items-center justify-between text-md text-fg">
									<span>
										{c.term} <span className="text-xs text-fg-3">{c.type.toLowerCase()}</span>
									</span>
									<IconButton
										label={`Remove ${c.term}`}
										size="sm"
										icon={<IconClose size={14} />}
										onClick={() => save({ customTerms: pii.customTerms.filter((x) => x !== c) })}
									/>
								</li>
							))}
						</ul>
					)}
				</Card>
			</Section>
			<Section title="Try it" description="Type something to see what gets masked.">
				<Card>
					<TextArea
						aria-label="Sample text"
						minRows={3}
						autoGrow
						value={sample}
						onChange={(e) => setSample(e.target.value)}
					/>
					{preview && (
						<div className="grid grid-cols-1 gap-3 text-md">
							<div>
								<div className="text-xs text-fg-3 mb-1">Found</div>
								<p className="od-selectable whitespace-pre-wrap text-fg">{highlight(sample, preview.items)}</p>
							</div>
							<div>
								<div className="text-xs text-fg-3 mb-1">What the model sees</div>
								<p className="od-selectable whitespace-pre-wrap text-fg">{preview.redacted}</p>
							</div>
						</div>
					)}
				</Card>
			</Section>
			<Section title="What is and isn't protected">
				<p className="text-sm text-fg-2">
					Masking applies to messages and tool results sent to cloud models. Models on this Mac never leave your
					computer, so nothing is masked for them. Detection is pattern-based, so unusual formats can slip through, and
					files you ask a Dot to read are only masked once their text enters the chat. Your chats, keys and settings
					always stay on this Mac.
				</p>
			</Section>
		</div>
	);
}
