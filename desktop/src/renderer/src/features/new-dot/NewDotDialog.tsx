import type { ConnectorChoice, DotDraft } from "@shared/types";
import { useState } from "react";
import { Dialog } from "@/design-system/components";
import { useUi } from "@/stores/ui";
import { DescribeStep } from "./DescribeStep";
import { ReviewStep } from "./ReviewStep";

interface Flow {
	step: "describe" | "review";
	prompt: string;
	connectors: ConnectorChoice[];
	draft?: DotDraft;
}

const FRESH: Flow = { step: "describe", prompt: "", connectors: [] };

export function NewDotDialog() {
	const open = useUi((s) => s.newDotOpen);
	const setOpen = useUi((s) => s.setNewDotOpen);
	const [flow, setFlow] = useState<Flow>(FRESH);

	const close = () => {
		setOpen(false);
		setFlow(FRESH);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => (o ? setOpen(true) : close())}
			size="lg"
			title={flow.step === "describe" ? "New Dot" : "Review your Dot"}
			description={
				flow.step === "describe"
					? "Describe the job and we'll shape an identity and personality for it."
					: "Tweak anything you like. You can change it all later."
			}
		>
			{open && flow.step === "describe" && (
				<DescribeStep
					initialPrompt={flow.prompt}
					initialConnectors={flow.connectors}
					onCancel={close}
					onDraft={({ draft, prompt, connectors }) => setFlow({ step: "review", draft, prompt, connectors })}
				/>
			)}
			{open && flow.step === "review" && flow.draft && (
				<ReviewStep
					draft={flow.draft}
					prompt={flow.prompt}
					connectors={flow.connectors}
					onBack={() => setFlow({ ...flow, step: "describe" })}
					onCreated={close}
				/>
			)}
		</Dialog>
	);
}
