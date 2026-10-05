// Injected OS bindings for the macOS tool set (spec 05 §6). Everything OS-specific goes through here so tests can mock it.
import type { NativeToolDeps } from "../native-types";

export interface MacDeps extends NativeToolDeps {
	clipboardRead(): string | Promise<string>;
	clipboardWrite(t: string): void;
	screenshot(): Promise<{ base64Png: string; width: number; height: number }>;
	notify(title: string, body: string): void;
	openUrl(url: string): Promise<void>;
	openApp(name: string): Promise<void>;
}
