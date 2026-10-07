// OS notifications for new approvals, coalesced: the first one shows at once, anything arriving
// within the window is folded into a single "N approvals waiting" when the window closes.
import type { ApprovalRequest } from "../../shared/types";

export interface ApprovalNotice {
	title: string;
	body: string;
	/** Renderer route to open when the notification is clicked. */
	hash: string;
}

export interface ApprovalNotifierDeps {
	notify(n: ApprovalNotice): void;
	pendingCount(): number;
	windowMs?: number;
	setTimer?: (fn: () => void, ms: number) => unknown;
	clearTimer?: (t: unknown) => void;
}

export const APPROVAL_NOTIFY_WINDOW_MS = 10_000;

export class ApprovalNotifier {
	private timer: unknown;
	private held: ApprovalRequest[] = [];
	private active = false;

	constructor(private readonly deps: ApprovalNotifierDeps) {}

	requested(req: ApprovalRequest): void {
		if (this.active) {
			this.held.push(req);
			return;
		}
		this.deps.notify({ title: req.title, body: "Open OpenDot to review it.", hash: `#/approvals/${req.id}` });
		this.startWindow();
	}

	private startWindow(): void {
		this.active = true;
		const set = this.deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
		this.timer = set(() => this.flush(), this.deps.windowMs ?? APPROVAL_NOTIFY_WINDOW_MS);
	}

	private flush(): void {
		const held = this.held;
		this.held = [];
		this.active = false;
		this.timer = undefined;
		if (held.length === 0) return;
		const count = Math.max(this.deps.pendingCount(), 0);
		if (count === 0) return;
		const last = held[held.length - 1]!;
		if (count === 1) {
			this.deps.notify({ title: last.title, body: "Open OpenDot to review it.", hash: `#/approvals/${last.id}` });
		} else {
			this.deps.notify({
				title: `${count} approvals waiting`,
				body: "Open OpenDot to review them.",
				hash: "#/approvals",
			});
		}
		this.startWindow();
	}

	dispose(): void {
		if (this.timer !== undefined)
			(this.deps.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>)))(this.timer);
		this.timer = undefined;
		this.held = [];
		this.active = false;
	}
}
