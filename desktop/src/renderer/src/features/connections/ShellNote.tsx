import { GIT_FOR_WINDOWS_URL } from "@shared/platform";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** True unless this is Windows without Git Bash, where the shell tool cannot run. */
export function useShellAvailable(): boolean {
	const [available, setAvailable] = useState(true);
	useEffect(() => {
		let live = true;
		Promise.resolve()
			.then(() => api.app.info())
			.then((i) => live && setAvailable(i.shellAvailable !== false))
			.catch(() => undefined);
		return () => {
			live = false;
		};
	}, []);
	return available;
}

export function ShellNote({ className }: { className?: string }) {
	return (
		<p className={className} data-testid="shell-note">
			Shell needs{" "}
			<button
				type="button"
				className="text-link hover:underline"
				onClick={() => void api.app.openExternal(GIT_FOR_WINDOWS_URL)}
			>
				Git for Windows (git-scm.com)
			</button>
			. Install it and restart OpenDot.
		</p>
	);
}
