import * as Popover from "@radix-ui/react-popover";
import type { Dot, PiiType } from "@shared/types";
import { navigate } from "../../app/router";
import { cn } from "../../design-system/cn";
import { IconShield } from "../../design-system/icons";
import { useChat } from "../../stores/chat";
import { useSettings } from "../../stores/settings";

const TYPE_LABEL: Record<PiiType, string> = {
	EMAIL: "email",
	PHONE: "phone",
	CARD: "card",
	IBAN: "IBAN",
	SSN: "ID number",
	IP: "IP address",
	SECRET: "secret",
	PERSON: "name",
	ADDRESS: "address",
	CUSTOM: "custom term",
	URL_CRED: "link with credentials",
};

/** Is this Dot's effective model local? (own model, else the default model) */
export function useDotModelLocal(dot: Dot): boolean | undefined {
	const models = useSettings((s) => s.models);
	const def = useSettings((s) => s.settings?.defaultModel);
	const ref = dot.model ?? def;
	if (!ref) return undefined;
	return models.find((m) => m.providerId === ref.providerId && m.modelId === ref.modelId)?.isLocal;
}

export function PiiBadge({ dot }: { dot: Dot }) {
	const local = useDotModelLocal(dot);
	const on = dot.piiMode === "always" || (dot.piiMode === "auto" && local !== true);
	const providerLabel = useSettings((s) => {
		const ref = dot.model ?? s.settings?.defaultModel;
		return s.models.find((m) => m.providerId === ref?.providerId && m.modelId === ref?.modelId)?.providerLabel;
	});
	const masked = useChat((s) => {
		const c = s.byDot[dot.id];
		const counts: Partial<Record<PiiType, number>> = {};
		if (c) for (const id of c.order) for (const t of c.byId[id]?.pii?.types ?? []) counts[t] = (counts[t] ?? 0) + 1;
		return Object.entries(counts)
			.map(([t, n]) => `${n} ${TYPE_LABEL[t as PiiType] ?? t}${n === 1 ? "" : "s"}`)
			.join(", ");
	});
	return (
		<Popover.Root>
			<Popover.Trigger asChild>
				<button
					type="button"
					aria-label={on ? "Privacy: private" : "Privacy: off"}
					className={cn(
						"flex h-7 items-center gap-1 rounded-full px-2 text-xs transition-colors",
						on ? "bg-accent-subtle text-accent" : "text-fg-3 hover:bg-hover",
					)}
				>
					<IconShield size={14} />
					{on ? "Private" : "Off"}
				</button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					align="end"
					sideOffset={6}
					className="z-popover w-72 rounded-lg bg-elevated p-3 text-sm shadow-md"
				>
					<div className="font-semibold text-fg">{on ? "Private mode is on" : "Private mode is off"}</div>
					<p className="mt-1 text-fg-2">
						{on
							? "Emails, phone numbers and other personal details are swapped for placeholders before they reach the model, and restored in your replies."
							: local
								? "This Dot uses a model on your computer, so nothing leaves your Mac."
								: "Personal details are sent to the model as written."}
					</p>
					{providerLabel && <p className="mt-1 text-xs text-fg-3">Provider: {providerLabel}</p>}
					<p className="mt-1 text-xs text-fg-3">
						{masked ? `Masked this chat: ${masked}` : "Nothing masked in this chat yet."}
					</p>
					<button
						type="button"
						onClick={() => navigate("#/settings/privacy")}
						className="mt-2 text-xs text-link hover:underline"
					>
						Privacy settings
					</button>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
