import { useState } from "react";
import { Button, Select, toast } from "@/design-system/components";
import { api, errorText } from "@/lib/api";
import { useSettings } from "@/stores/settings";

const SEP = "::";

export function DefaultModelPicker() {
	const settings = useSettings((s) => s.settings);
	const models = useSettings((s) => s.models);
	const update = useSettings((s) => s.update);
	const [testing, setTesting] = useState(false);
	const dm = settings?.defaultModel;
	const value = dm ? `${dm.providerId}${SEP}${dm.modelId}` : "";

	const byProvider = new Map<string, typeof models>();
	for (const m of models) byProvider.set(m.providerLabel, [...(byProvider.get(m.providerLabel) ?? []), m]);
	const groups = [...byProvider.entries()].map(([label, items]) => ({
		label,
		items: items.map((m) => ({
			value: `${m.providerId}${SEP}${m.modelId}`,
			label: `${m.label}${m.isLocal ? " (local)" : ""}`,
		})),
	}));

	const test = async () => {
		if (!dm) return;
		setTesting(true);
		try {
			const r = await api.models.test(dm.providerId, dm.modelId);
			toast({
				title: r.ok ? "Model works" : "Test failed",
				description: r.ok && r.latencyMs ? `${r.message} (${r.latencyMs} ms)` : r.message,
				variant: r.ok ? "success" : "error",
			});
		} catch (e) {
			toast({ title: "Test failed", description: errorText(e), variant: "error" });
		} finally {
			setTesting(false);
		}
	};

	return (
		<div className="flex items-center gap-2">
			<div className="flex-1">
				<Select
					aria-label="Default model"
					value={value}
					placeholder={models.length ? "Choose a model" : "Add a provider first"}
					groups={groups}
					onValueChange={(v) => {
						const i = v.indexOf(SEP);
						update({ defaultModel: { providerId: v.slice(0, i), modelId: v.slice(i + SEP.length) } }).catch((e) =>
							toast({ title: "Couldn't save", description: errorText(e), variant: "error" }),
						);
					}}
				/>
			</div>
			<Button variant="secondary" loading={testing} disabled={!dm} onClick={() => void test()}>
				Test
			</Button>
		</div>
	);
}
