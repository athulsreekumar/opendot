import type { Dot } from "@shared/types";
import { useState } from "react";
import { Avatar, Button, Input } from "@/design-system/components";
import { ColorSwatches } from "@/features/new-dot/ColorSwatches";
import { EmojiPicker } from "@/features/new-dot/EmojiPicker";
import { ChipInput } from "./editors";
import { Field, SectionCard } from "./ui";
import { useDotSaver } from "./useDotSaver";

export const ROLE_SUGGESTIONS = [
	"assistant",
	"comms",
	"scheduling",
	"research",
	"dev",
	"finance",
	"personal",
	"trusted",
];

export function IdentitySection({ dot }: { dot: Dot }) {
	const { save, saved } = useDotSaver(dot.id);
	const [name, setName] = useState(dot.name);
	const [emojiOpen, setEmojiOpen] = useState(false);
	const nameOk = name.trim().length >= 1 && name.trim().length <= 32;

	return (
		<SectionCard title="Identity" saved={saved} testId="section-identity">
			<div className="flex items-center gap-4">
				<Avatar
					size="xl"
					name={dot.name}
					emoji={dot.appearance.emoji}
					color={dot.appearance.color}
					mark={dot.kind === "super"}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<Field label="Name">
						<Input
							aria-label="Name"
							value={name}
							maxLength={32}
							invalid={!nameOk}
							onChange={(e) => {
								setName(e.target.value);
								const v = e.target.value.trim();
								if (v.length >= 1 && v.length <= 32) save({ name: v });
							}}
						/>
					</Field>
				</div>
			</div>
			{dot.kind !== "super" && (
				<>
					<Field label="Emoji">
						<div>
							<Button variant="secondary" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}>
								<span className="text-xl">{dot.appearance.emoji}</span> Change emoji
							</Button>
						</div>
						{emojiOpen && (
							<EmojiPicker
								value={dot.appearance.emoji}
								onChange={(emoji) => {
									save({ appearance: { ...dot.appearance, emoji } });
									setEmojiOpen(false);
								}}
							/>
						)}
					</Field>
					<ColorSwatches
						value={dot.appearance.color}
						onChange={(color) => save({ appearance: { ...dot.appearance, color } })}
					/>
				</>
			)}
			<Field label="Tagline">
				<Input
					aria-label="Tagline"
					value={dot.tagline}
					maxLength={60}
					onChange={(e) => save({ tagline: e.target.value })}
				/>
			</Field>
			<ChipInput
				label="Roles"
				values={dot.roles}
				max={8}
				maxLen={24}
				suggestions={ROLE_SUGGESTIONS}
				placeholder="Add a role"
				onChange={(roles) => save({ roles: roles.map((r) => r.toLowerCase()) })}
			/>
		</SectionCard>
	);
}
