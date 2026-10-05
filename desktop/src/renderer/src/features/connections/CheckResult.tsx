import type { ConnectionStatus } from "@shared/types";
import { StatusPill } from "@/design-system/components";

export function CheckResult({ status }: { status: ConnectionStatus }) {
	const ok = status.state === "connected";
	return (
		<div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-sunken p-3" aria-live="polite">
			<div className="flex items-center gap-2">
				<StatusPill state={status.state} />
				{ok && (
					<span className="text-sm text-fg-2">
						Found {status.toolCount} {status.toolCount === 1 ? "tool" : "tools"}
					</span>
				)}
			</div>
			{status.error && <p className="text-sm text-danger">{status.error}</p>}
			{ok && status.tools.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{status.tools.slice(0, 12).map((t) => (
						<span key={t.name} className="rounded-sm bg-active px-1.5 py-0.5 font-mono text-2xs text-fg-2">
							{t.name}
						</span>
					))}
					{status.tools.length > 12 && <span className="text-2xs text-fg-3">+{status.tools.length - 12} more</span>}
				</div>
			)}
			{status.stderrTail && (
				<pre className="od-selectable max-h-32 overflow-auto whitespace-pre-wrap rounded-sm bg-app p-2 font-mono text-2xs text-fg-2">
					{status.stderrTail}
				</pre>
			)}
		</div>
	);
}
