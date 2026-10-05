import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "../cn";

export interface ToastMessage {
	id: string;
	title: string;
	description?: string;
	variant?: "info" | "success" | "warning" | "error";
	action?: {
		label: string;
		onClick: () => void;
	};
}

interface ToastStore {
	toasts: ToastMessage[];
	add: (toast: Omit<ToastMessage, "id">) => string;
	remove: (id: string) => void;
}

export const useToasts = create<ToastStore>((set) => ({
	toasts: [],
	add: (toast) => {
		const id = Math.random().toString(36).substr(2, 9);
		set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

		// Auto dismiss
		const duration = toast.variant === "error" ? 8000 : 4000;
		setTimeout(() => {
			set((state) => ({
				toasts: state.toasts.filter((t) => t.id !== id),
			}));
		}, duration);

		return id;
	},
	remove: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((t) => t.id !== id),
		})),
}));

export const toast = (message: Omit<ToastMessage, "id">): string => {
	return useToasts.getState().add(message);
};

const variantConfig = {
	info: {
		icon: Info,
		className: "bg-info-subtle text-info",
	},
	success: {
		icon: CheckCircle,
		className: "bg-success-subtle text-success",
	},
	warning: {
		icon: AlertTriangle,
		className: "bg-warning-subtle text-warning",
	},
	error: {
		icon: AlertCircle,
		className: "bg-danger-subtle text-danger",
	},
};

const ToastItem = ({ toast: t }: { toast: ToastMessage }) => {
	const variant = t.variant || "info";
	const config = variantConfig[variant];
	const Icon = config.icon;

	return (
		<div
			className={cn("bg-elevated rounded-lg shadow-lg p-4 min-w-80", "flex items-start gap-3")}
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			<Icon size={20} className={cn("flex-shrink-0 mt-0.5", config.className)} />

			<div className="flex-1">
				<div className="text-sm font-medium text-fg">{t.title}</div>
				{t.description && <div className="text-sm text-fg-2 mt-1">{t.description}</div>}
				{t.action && (
					<button
						type="button"
						onClick={t.action.onClick}
						className="text-sm font-medium text-accent hover:text-accent-hover mt-2"
					>
						{t.action.label}
					</button>
				)}
			</div>

			<button
				type="button"
				onClick={() => useToasts.getState().remove(t.id)}
				aria-label="Close"
				className="flex-shrink-0 p-1 hover:bg-hover rounded transition-colors"
			>
				<X size={16} className="text-fg-2" />
			</button>
		</div>
	);
};

export const Toaster = () => {
	const toasts = useToasts((state) => state.toasts);

	return (
		<section
			className="fixed bottom-6 right-6 z-toast flex flex-col gap-3 pointer-events-none"
			aria-label="Notifications"
		>
			{toasts.map((t) => (
				<div key={t.id} className="pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200">
					<ToastItem toast={t} />
				</div>
			))}
		</section>
	);
};

Toaster.displayName = "Toaster";
