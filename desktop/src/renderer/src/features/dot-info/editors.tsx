import type { Persona, Tone } from "@shared/types";
import { type KeyboardEvent, useState } from "react";
import { Button, IconButton, Input, SegmentedControl, Slider, TextArea } from "@/design-system/components";
import { IconClose, IconPlus } from "@/design-system/icons";
import { Collapsible, Field } from "./ui";

/** Chip input: Enter or comma adds, ✕ removes. Optional suggestion chips. */
export function ChipInput({
	label,
	values,
	onChange,
	max = 5,
	maxLen = 80,
	suggestions,
	placeholder = "Type and press Enter",
}: {
	label: string;
	values: string[];
	onChange: (next: string[]) => void;
	max?: number;
	maxLen?: number;
	suggestions?: string[];
	placeholder?: string;
}) {
	const [text, setText] = useState("");
	const add = (raw: string) => {
		const v = raw.trim().slice(0, maxLen);
		if (!v || values.length >= max || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
		onChange([...values, v]);
		setText("");
	};
	const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			add(text);
		} else if (e.key === "Backspace" && !text && values.length > 0) {
			onChange(values.slice(0, -1));
		}
	};
	const open = (suggestions ?? []).filter((s) => !values.includes(s));
	return (
		<Field label={label}>
			<div className="flex flex-wrap gap-1.5">
				{values.map((v) => (
					<span key={v} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-active text-xs text-fg">
						{v}
						<button
							type="button"
							aria-label={`Remove ${v}`}
							onClick={() => onChange(values.filter((x) => x !== v))}
							className="rounded-full p-0.5 hover:bg-hover"
						>
							<IconClose size={12} />
						</button>
					</span>
				))}
			</div>
			{values.length < max && (
				<Input
					aria-label={`Add to ${label}`}
					value={text}
					placeholder={placeholder}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={onKey}
					onBlur={() => add(text)}
				/>
			)}
			{open.length > 0 && values.length < max && (
				<div className="flex flex-wrap gap-1.5">
					{open.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => add(s)}
							className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-border-subtle text-xs text-fg-2 hover:bg-hover"
						>
							<IconPlus size={10} /> {s}
						</button>
					))}
				</div>
			)}
		</Field>
	);
}

/** Editable list of short strings (Always / Never). */
export function ListEditor({
	label,
	values,
	onChange,
	max = 10,
	maxLen = 160,
	placeholder,
}: {
	label: string;
	values: string[];
	onChange: (next: string[]) => void;
	max?: number;
	maxLen?: number;
	placeholder?: string;
}) {
	const [text, setText] = useState("");
	const add = () => {
		const v = text.trim().slice(0, maxLen);
		if (!v || values.length >= max) return;
		onChange([...values, v]);
		setText("");
	};
	return (
		<Field label={label}>
			<ul className="flex flex-col gap-1">
				{values.map((v, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place, so the index is the identity
					<li key={i} className="flex items-center gap-1">
						<Input
							aria-label={`${label} ${i + 1}`}
							value={v}
							maxLength={maxLen}
							onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
							onBlur={() => onChange(values.filter((x) => x.trim()))}
						/>
						<IconButton
							label={`Remove ${label} ${i + 1}`}
							size="sm"
							icon={<IconClose size={14} />}
							onClick={() => onChange(values.filter((_, j) => j !== i))}
						/>
					</li>
				))}
			</ul>
			{values.length < max && (
				<div className="flex items-center gap-1">
					<Input
						aria-label={`New ${label}`}
						value={text}
						maxLength={maxLen}
						placeholder={placeholder ?? "Add one"}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								add();
							}
						}}
					/>
					<Button variant="secondary" size="md" onClick={add} disabled={!text.trim()}>
						Add
					</Button>
				</div>
			)}
		</Field>
	);
}

export const TONES: Array<{ value: Tone; label: string }> = [
	{ value: "warm", label: "Warm" },
	{ value: "neutral", label: "Neutral" },
	{ value: "playful", label: "Playful" },
	{ value: "direct", label: "Direct" },
	{ value: "formal", label: "Formal" },
];

/**
 * Persona fields shared by New Dot → Review and Dot Info → Personality (spec 08 §2).
 * `collapsibleRules` wraps role/quirks/dos/donts in a collapsible (Review); `full` adds greeting + custom instructions.
 */
export function PersonaEditor({
	persona,
	onChange,
	collapsibleRules = false,
	full = false,
}: {
	persona: Persona;
	onChange: (partial: Partial<Persona>) => void;
	collapsibleRules?: boolean;
	full?: boolean;
}) {
	const rules = (
		<>
			<Field label="Role">
				<TextArea
					aria-label="Role"
					value={persona.role}
					minRows={3}
					maxRows={8}
					autoGrow
					maxLength={600}
					showCount
					onChange={(e) => onChange({ role: e.target.value })}
				/>
			</Field>
			<ChipInput
				label="Quirks"
				values={persona.quirks}
				onChange={(quirks) => onChange({ quirks })}
				max={5}
				maxLen={80}
			/>
			<ListEditor
				label="Always"
				values={persona.dos}
				onChange={(dos) => onChange({ dos })}
				placeholder="Something it should always do"
			/>
			<ListEditor
				label="Never"
				values={persona.donts}
				onChange={(donts) => onChange({ donts })}
				placeholder="Something it should never do"
			/>
		</>
	);
	return (
		<div className="flex flex-col gap-4">
			<Field label="Tone">
				<SegmentedControl
					aria-label="Tone"
					value={persona.tone}
					options={TONES}
					onValueChange={(v) => onChange({ tone: v as Tone })}
				/>
			</Field>
			<Field label="Length of answers">
				<Slider
					aria-label="Verbosity"
					min={0}
					max={100}
					step={10}
					value={persona.verbosity}
					onValueChange={(verbosity) => onChange({ verbosity })}
					leftLabel="Brief"
					rightLabel="Detailed"
				/>
			</Field>
			<Field label="Formality">
				<Slider
					aria-label="Formality"
					min={0}
					max={100}
					step={10}
					value={persona.formality}
					onValueChange={(formality) => onChange({ formality })}
					leftLabel="Casual"
					rightLabel="Formal"
				/>
			</Field>
			<Field label="Emoji">
				<Slider
					aria-label="Emoji usage"
					min={0}
					max={100}
					step={25}
					value={persona.emojiUsage}
					onValueChange={(emojiUsage) => onChange({ emojiUsage })}
					leftLabel="None"
					rightLabel="Lots"
				/>
			</Field>
			{collapsibleRules ? <Collapsible title="Role, quirks and rules">{rules}</Collapsible> : rules}
			{full && (
				<>
					<Field label="Greeting">
						<Input
							aria-label="Greeting"
							value={persona.greeting}
							maxLength={200}
							onChange={(e) => onChange({ greeting: e.target.value })}
						/>
					</Field>
					<Collapsible title="Advanced">
						<Field
							label="Custom instructions"
							hint="Extra instructions added to the end of the prompt. They can't override safety rules."
						>
							<TextArea
								aria-label="Custom instructions"
								value={persona.customInstructions}
								minRows={3}
								maxRows={10}
								autoGrow
								maxLength={4000}
								showCount
								onChange={(e) => onChange({ customInstructions: e.target.value })}
							/>
						</Field>
					</Collapsible>
				</>
			)}
		</div>
	);
}
