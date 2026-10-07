import type { OrgLogEntry } from "@shared/organisation";
import { relativeTime } from "@/lib/format";

export function ActivityLog({ log }: { log: OrgLogEntry[] }) {
	const rows = [...log].reverse();
	return (
		<section aria-label="Activity" className="flex flex-col gap-2">
			<h2 className="text-lg font-semibold text-fg">Activity</h2>
			{rows.length === 0 ? (
				<p className="text-sm text-fg-2">Nothing has happened yet.</p>
			) : (
				<ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-elevated">
					{rows.map((e) => (
						<li
							key={`${e.at}-${e.kind}-${e.taskId ?? ""}-${e.text}`}
							className="flex items-start gap-3 px-4 py-2 text-sm"
						>
							<span className={e.kind === "error" ? "min-w-0 flex-1 text-danger" : "min-w-0 flex-1 text-fg"}>
								{e.text}
							</span>
							<time dateTime={e.at} className="shrink-0 text-xs text-fg-3">
								{relativeTime(e.at)}
							</time>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
