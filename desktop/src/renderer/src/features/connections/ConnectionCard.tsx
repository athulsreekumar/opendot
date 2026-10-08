import type { Connection, Dot } from "@shared/types";
import {
	BookOpen,
	Brain as BrainIcon,
	Bug,
	Calendar,
	Clock,
	CreditCard,
	Database,
	FileText,
	Folder,
	GitBranch,
	Globe,
	HardDrive,
	ListChecks,
	type LucideIcon,
	Laptop as MacIcon,
	Mail,
	MessageSquare,
	Plug,
	Search,
	Smile,
	Terminal,
	Triangle,
} from "lucide-react";
import { navigate } from "@/app/router";
import { cn } from "@/design-system/cn";
import { Avatar, Button, StatusPill } from "@/design-system/components";
import { useDots } from "@/stores/dots";
import { useRuntime } from "@/stores/runtime";

const ICONS: Record<string, LucideIcon> = {
	globe: Globe,
	"list-checks": ListChecks,
	"book-open": BookOpen,
	triangle: Triangle,
	smile: Smile,
	github: GitBranch,
	"git-branch": GitBranch,
	folder: Folder,
	database: Database,
	"credit-card": CreditCard,
	clock: Clock,
	bug: Bug,
	brain: BrainIcon,
	mail: Mail,
	calendar: Calendar,
	drive: HardDrive,
	file: FileText,
	"file-text": FileText,
	terminal: Terminal,
	laptop: MacIcon,
	mac: MacIcon,
	search: Search,
	chat: MessageSquare,
	"message-square": MessageSquare,
	"message-circle": MessageSquare,
	figma: Smile,
};

export function ConnectionIcon({ name, size = 20 }: { name: string; size?: number }) {
	const Icon = ICONS[name] ?? Plug;
	return <Icon size={size} aria-hidden />;
}

export function IconTile({ name, className }: { name: string; className?: string }) {
	return (
		<div
			className={cn(
				"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent",
				className,
			)}
		>
			<ConnectionIcon name={name} />
		</div>
	);
}

export function dotsUsing(dots: Dot[], connectionId: string): Dot[] {
	return dots.filter((d) => !d.archived && d.grants.some((g) => g.connectionId === connectionId));
}

export function UsedByStack({ dots }: { dots: Dot[] }) {
	if (dots.length === 0) return <span className="text-xs text-fg-3">Not used by any Dot yet</span>;
	return (
		<div className="flex items-center gap-2">
			<div className="flex -space-x-2">
				{dots.slice(0, 4).map((d) => (
					<Avatar
						key={d.id}
						size="xs"
						icon={d.appearance.icon}
						color={d.appearance.color}
						name={d.name}
						mark={d.kind === "super"}
						className="ring-2 ring-elevated"
					/>
				))}
			</div>
			<span className="text-xs text-fg-2">
				Used by {dots.length} {dots.length === 1 ? "Dot" : "Dots"}
			</span>
		</div>
	);
}

export function ConnectionStatePill({ connection }: { connection: Connection }) {
	const status = useRuntime((s) => s.connectionStatus[connection.id]);
	const state = !connection.enabled ? "disabled" : (status?.state ?? "disconnected");
	return <StatusPill state={state} />;
}

export function ConnectionCard({ connection }: { connection: Connection }) {
	const dots = useDots((s) => s.dots);
	const users = dotsUsing(dots, connection.id);
	const needsSetup = (connection.type === "google" || connection.type === "microsoft") && !connection.configured;
	return (
		<div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-elevated p-4">
			<div className="flex items-start gap-3">
				<IconTile name={connection.icon} />
				<div className="min-w-0 flex-1">
					<div className="truncate text-md font-semibold text-fg">{connection.label}</div>
					<p className="line-clamp-2 text-sm text-fg-2">{connection.description}</p>
				</div>
			</div>
			<div className="flex items-center justify-between gap-2">
				{needsSetup ? (
					<StatusPill state="disconnected" label="Not set up" />
				) : (
					<ConnectionStatePill connection={connection} />
				)}
				<Button size="sm" variant="secondary" onClick={() => navigate(`#/connections/${connection.id}`)}>
					{needsSetup ? "Set up" : "Manage"}
				</Button>
			</div>
			<UsedByStack dots={users} />
		</div>
	);
}
