import { ipcMain } from "electron";
import { INVOKE_CHANNELS, type IpcHandlers } from "../../shared/ipc";
import { ARG_SCHEMAS } from "../../shared/schemas";
import { log } from "../log";

export class IpcValidationError extends Error {
	code = "INVALID_ARGS";
}

/** Validate args with zod (when a schema exists) and call the handler. Exported for tests. */
export async function invokeHandler(handlers: IpcHandlers, channel: string, args: unknown[]): Promise<unknown> {
	const schema = ARG_SCHEMAS[channel];
	if (schema) {
		const r = schema.safeParse(args);
		if (!r.success) throw new IpcValidationError(`Invalid input: ${r.error.issues.map((i) => i.message).join("; ")}`);
	}
	const fn = (handlers as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[channel];
	if (!fn) throw Object.assign(new Error(`Unknown channel ${channel}`), { code: "UNKNOWN_CHANNEL" });
	return fn(...args);
}

export function registerIpc(handlers: IpcHandlers): void {
	for (const channel of INVOKE_CHANNELS) {
		ipcMain.handle(channel, async (_e, args: unknown[]) => {
			try {
				return await invokeHandler(handlers, channel, Array.isArray(args) ? args : []);
			} catch (e) {
				const err = e as { code?: string; message?: string };
				if (!err.code) log.warn(`[ipc] ${channel} failed`, e);
				// Plain object: Electron serialises it; no stack traces cross the boundary.
				throw new Error(JSON.stringify({ code: err.code ?? "ERROR", message: err.message ?? String(e) }));
			}
		});
	}
}
