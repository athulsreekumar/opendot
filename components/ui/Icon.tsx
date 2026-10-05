import type { LucideIcon, LucideProps } from "lucide-react";

/** Site-wide icon set: import icons from here so every file draws from one list. */
export {
	ArrowRight,
	ArrowUpRight,
	Bell,
	Bot,
	Calendar,
	Check,
	ChevronRight,
	Cloud,
	Cpu,
	FileText,
	Folder,
	Globe,
	Laptop,
	Link2,
	Lock,
	Mail,
	Moon,
	Pause,
	Play,
	Search,
	Shield,
	Sparkles,
	Volume2,
	VolumeX,
	Webhook,
	X,
	Zap,
} from "lucide-react";

/** Thin lucide wrapper with the site defaults (20px, 1.75 stroke). `<Icon as={Mail} size={20} />` */
export function Icon({
	as: Glyph,
	size = 20,
	strokeWidth = 1.75,
	...props
}: { as: LucideIcon } & Omit<LucideProps, "ref">) {
	return (
		<Glyph size={size} strokeWidth={strokeWidth} aria-hidden={props["aria-label"] ? undefined : true} {...props} />
	);
}
