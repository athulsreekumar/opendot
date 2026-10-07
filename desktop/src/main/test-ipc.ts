// Test-only IPC (OPENDOT_E2E=1): fake model scripts, captured contexts, paint timings, synthetic events.
import type { IpcMain } from "electron";
import type { DotId } from "../shared/types";
import type { QuickAskController } from "./quickask/quick-ask";
import type { Services } from "./services";

export function registerTestIpc(ipcMain: IpcMain, s: Services, quickAsk?: QuickAskController): void {
	const paints: Array<{ messageId: string; paintAt: number }> = [];
	const h = (c: string, fn: (...a: never[]) => unknown) =>
		ipcMain.handle(c, (_e, args: unknown[]) => fn(...((args ?? []) as never[])));
	h("test.setFakeScript", (name: string) => s.models.fake?.setScript(name));
	h("test.appendFakeScript", (name: string) => s.models.fake?.appendScript(name));
	h("test.getCaptured", () => s.models.fake?.captured ?? []);
	h("test.reportPaint", (messageId: string, at: number) => {
		if (!paints.some((p) => p.messageId === messageId)) paints.push({ messageId, paintAt: at });
	});
	h("test.getPaints", () => paints);
	h("test.knowledgeAddFolder", (path: string) => s.knowledge.addFolder(path));
	h("test.emitEvent", async (dotId: string, title: string, body: string, importance?: "low" | "normal" | "high") => {
		const dot = await s.store.dots.get(dotId as DotId);
		if (!dot) throw new Error("no dot");
		await s.router.receive(
			dot,
			{ id: "wat_testevent0001", type: "local-webhook" },
			{
				title,
				body,
				facts: {},
				dedupeKey: `${Date.now()}-${Math.random()}`,
				importanceHint: importance ?? "normal",
				occurredAt: new Date().toISOString(),
			},
		);
	});
	h("test.openQuickAsk", (toggle?: boolean) => (toggle ? quickAsk?.toggle() : quickAsk?.show()));
	h("test.quickAskState", () => quickAsk?.state());
	h("test.blurQuickAsk", () => quickAsk?.simulateBlur());
}
