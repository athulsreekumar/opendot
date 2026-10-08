import type { LucideIcon } from "lucide-react";
import {
	Briefcase,
	ChartColumn,
	Compass,
	FolderKanban,
	Headphones,
	Icon,
	Megaphone,
	Monitor,
	Palette,
	Scale,
	Shield,
	Sprout,
	Wallet,
	Wrench,
} from "@/components/ui/Icon";
import type { DeptIconName } from "@/lib/copy";

const ICONS: Record<DeptIconName, LucideIcon> = {
	Wrench,
	Compass,
	Palette,
	Shield,
	Monitor,
	ChartColumn,
	Sprout,
	FolderKanban,
	Wallet,
	Scale,
	Megaphone,
	Briefcase,
	Headphones,
};

/** The line icon for a department Dot (replaces the app's emoji on the website). Decorative. */
export function DeptIcon({ name, size = 20, className }: { name: DeptIconName; size?: number; className?: string }) {
	return <Icon as={ICONS[name]} size={size} className={className} />;
}
