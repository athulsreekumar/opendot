import { contextBridge, ipcRenderer } from "electron";
import { EVENT_CHANNELS, INVOKE_CHANNELS } from "../shared/ipc";

function unwrap(e: unknown): never {
	const msg = e instanceof Error ? e.message : String(e);
	const m = /\{"code":.*\}$/.exec(msg);
	if (m) {
		try {
			const { code, message } = JSON.parse(m[0]) as { code: string; message: string };
			throw Object.assign(new Error(message), { code });
		} catch (inner) {
			if ((inner as { code?: string }).code) throw inner;
		}
	}
	throw e;
}

const api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> & { on?: unknown } = {};
for (const channel of INVOKE_CHANNELS) {
	const [ns, method] = channel.split(".") as [string, string];
	api[ns] ??= {};
	api[ns][method] = (...args: unknown[]) => ipcRenderer.invoke(channel, args).catch(unwrap);
}
(api as { on: unknown }).on = (event: string, listener: (payload: unknown) => void) => {
	if (!(EVENT_CHANNELS as readonly string[]).includes(event)) throw new Error(`Unknown event ${event}`);
	const fn = (_e: unknown, payload: unknown) => listener(payload);
	ipcRenderer.on(event, fn);
	return () => ipcRenderer.removeListener(event, fn);
};
contextBridge.exposeInMainWorld("opendot", api);

if (process.env.OPENDOT_E2E === "1") {
	const t =
		(c: string) =>
		(...args: unknown[]) =>
			ipcRenderer.invoke(c, args);
	contextBridge.exposeInMainWorld("opendotTest", {
		setFakeScript: t("test.setFakeScript"),
		appendFakeScript: t("test.appendFakeScript"),
		getCaptured: t("test.getCaptured"),
		reportPaint: t("test.reportPaint"),
		getPaints: t("test.getPaints"),
		emitEvent: t("test.emitEvent"),
	});
}
