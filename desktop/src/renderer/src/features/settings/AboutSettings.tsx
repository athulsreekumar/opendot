import { useEffect, useState } from "react";
import { Button } from "@/design-system/components";
import { IconExternal } from "@/design-system/icons";
import { api } from "@/lib/api";
import { Card } from "./parts";

const PI_REPO = "https://github.com/earendil-works/pi";

export function AboutSettings() {
	const [info, setInfo] = useState<{ version: string; piVersion: string } | undefined>();
	useEffect(() => {
		api.app
			.info()
			.then(setInfo)
			.catch(() => undefined);
	}, []);
	const rows: Array<[string, string]> = [
		["OpenDot version", info?.version ?? "…"],
		["pi version", info?.piVersion ?? "…"],
		["Data folder", "~/.opendot"],
		["License", "MIT"],
	];
	return (
		<Card>
			<dl className="flex flex-col gap-2">
				{rows.map(([k, v]) => (
					<div key={k} className="flex items-center justify-between text-md">
						<dt className="text-fg-2">{k}</dt>
						<dd className="text-fg od-selectable">{v}</dd>
					</div>
				))}
			</dl>
			<p className="text-sm text-fg-2">
				OpenDot is built on pi, an open-source agent toolkit. Thank you to everyone who works on it.
			</p>
			<div>
				<Button
					variant="secondary"
					trailingIcon={<IconExternal size={14} />}
					onClick={() => void api.app.openExternal(PI_REPO)}
				>
					pi on GitHub
				</Button>
			</div>
		</Card>
	);
}
