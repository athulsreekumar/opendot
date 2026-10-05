import type { Connection, MacCapability, MacPermissionStatus } from "@shared/types";
import { MAC_CAPABILITIES } from "@shared/types";
import {
	Accessibility,
	Bell,
	CalendarDays,
	Clipboard as ClipboardIcon,
	ClipboardList,
	Folder,
	type LucideIcon,
	Monitor,
	Notebook,
	SquareArrowOutUpRight,
	Terminal,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/design-system/cn";
import { Button, Spinner, Switch, toast } from "@/design-system/components";
import { IconInfo } from "@/design-system/icons";
import { api, errorText } from "@/lib/api";
import { useRuntime } from "@/stores/runtime";

export const MAC_INFO: Record<MacCapability, { label: string; description: string; icon: LucideIcon }> = {
	files: { label: "Files", description: "Read and edit files in folders you choose.", icon: Folder },
	shell: { label: "Terminal", description: "Run commands on your Mac, always asking first.", icon: Terminal },
	calendar: { label: "Calendar", description: "See your events and add new ones.", icon: CalendarDays },
	reminders: { label: "Reminders", description: "Read, add and complete reminders.", icon: ClipboardList },
	contacts: { label: "Contacts", description: "Look people up in your address book.", icon: Users },
	notes: { label: "Notes", description: "Search, read and create notes.", icon: Notebook },
	screen: { label: "Screen", description: "Take screenshots so a Dot can see what you see.", icon: Monitor },
	clipboard: { label: "Clipboard", description: "Read and write what you copied.", icon: ClipboardIcon },
	notifications: { label: "Notifications", description: "Show notifications from a Dot.", icon: Bell },
	open: { label: "Open links and apps", description: "Open web pages and apps for you.", icon: SquareArrowOutUpRight },
	accessibility: { label: "Accessibility", description: "Control other apps on your Mac.", icon: Accessibility },
};

const PILL: Record<MacPermissionStatus["status"] | "unavailable", { label: string; cls: string }> = {
	granted: { label: "Granted", cls: "bg-success-subtle text-success" },
	denied: { label: "Not allowed", cls: "bg-danger-subtle text-danger" },
	"not-determined": { label: "Not asked yet", cls: "bg-warning-subtle text-warning" },
	restricted: { label: "Not allowed", cls: "bg-danger-subtle text-danger" },
	"not-required": { label: "Not required", cls: "bg-active text-fg-3" },
	unavailable: { label: "Unavailable", cls: "bg-active text-fg-3" },
};

export function PermissionPill({ status }: { status: MacPermissionStatus["status"] | "unavailable" }) {
	const p = PILL[status];
	return (
		<span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", p.cls)}>
			<span className="h-1.5 w-1.5 rounded-full bg-current" />
			{p.label}
		</span>
	);
}

export function MacPermissions() {
	const [perms, setPerms] = useState<MacPermissionStatus[] | undefined>();
	const [failed, setFailed] = useState(false);
	const [busy, setBusy] = useState<string | undefined>();
	const mac = useRuntime((s) => s.connections.find((c: Connection) => c.type === "mac"));

	const load = useCallback(async () => {
		try {
			setPerms(await api.connections.macPermissions());
			setFailed(false);
		} catch {
			setFailed(true);
			setPerms([]);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const request = async (cap: MacCapability) => {
		setBusy(cap);
		try {
			const st = await api.connections.requestMacPermission(cap);
			setPerms((p) => (p ?? []).map((x) => (x.capability === cap ? st : x)));
		} catch (e) {
			toast({ title: "Couldn't ask macOS", description: errorText(e), variant: "error" });
		} finally {
			setBusy(undefined);
		}
	};

	const toggle = async (cap: MacCapability, on: boolean) => {
		if (!mac) return;
		setBusy(`f-${cap}`);
		try {
			const features = on ? [...new Set([...mac.features, cap])] : mac.features.filter((f) => f !== cap);
			await api.connections.update(mac.id, { features });
			await useRuntime.getState().loadConnections();
		} catch (e) {
			toast({ title: "Couldn't save", description: errorText(e), variant: "error" });
		} finally {
			setBusy(undefined);
		}
	};

	if (!perms) {
		return (
			<div className="flex justify-center py-12">
				<Spinner size={24} />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-start gap-2 rounded-md bg-info-subtle p-3 text-sm text-info">
				<IconInfo size={16} className="mt-0.5 shrink-0" />
				macOS asks once per capability. If you denied it, enable OpenDot in System Settings.
			</div>
			<ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-elevated">
				{MAC_CAPABILITIES.map((cap) => {
					const info = MAC_INFO[cap];
					const Icon = info.icon;
					const perm = perms.find((p) => p.capability === cap);
					const status = perm?.status ?? "unavailable";
					return (
						<li key={cap} className="flex flex-wrap items-center gap-3 p-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
								<Icon size={20} aria-hidden />
							</div>
							<div className="min-w-0 flex-1">
								<div className="text-md font-medium text-fg">{info.label}</div>
								<div className="text-sm text-fg-2">{info.description}</div>
							</div>
							<PermissionPill status={failed ? "unavailable" : status} />
							{status === "not-determined" && (
								<Button size="sm" loading={busy === cap} onClick={() => void request(cap)}>
									Request access
								</Button>
							)}
							{perm?.settingsUrl && status !== "granted" && status !== "not-required" && (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => perm.settingsUrl && void api.app.openExternal(perm.settingsUrl)}
								>
									Open System Settings
								</Button>
							)}
							{mac && (
								<Switch
									aria-label={`Allow ${info.label} for Dots`}
									checked={mac.features.includes(cap)}
									disabled={busy === `f-${cap}`}
									onCheckedChange={(on) => void toggle(cap, on)}
								/>
							)}
						</li>
					);
				})}
			</ul>
			{mac && (
				<p className="text-xs text-fg-3">
					Switches decide which capabilities Dots can be given. Each Dot still needs its own permission.
				</p>
			)}
		</div>
	);
}
