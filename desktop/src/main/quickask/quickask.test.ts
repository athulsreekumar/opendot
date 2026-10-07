import { describe, expect, it, vi } from "vitest";
import { QUICK_ASK_IN_USE } from "../../shared/quickask";
import { clampHeight, keepOnScreen, QUICK_ASK_MAX_HEIGHT, QUICK_ASK_MIN_HEIGHT, quickAskBounds } from "./bounds";
import { ShortcutManager } from "./shortcut";

vi.mock("../log", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function fakeApi(taken: string[] = []) {
	const registered = new Map<string, () => void>();
	return {
		registered,
		register: vi.fn((acc: string, cb: () => void) => {
			if (taken.includes(acc) || registered.has(acc)) return false;
			registered.set(acc, cb);
			return true;
		}),
		unregister: vi.fn((acc: string) => {
			registered.delete(acc);
		}),
	};
}

describe("ShortcutManager", () => {
	it("registers the shortcut and calls back on press", () => {
		const api = fakeApi();
		const onPress = vi.fn();
		const m = new ShortcutManager(api, onPress);
		expect(m.apply({ enabled: true, shortcut: "Alt+Space" })).toEqual({
			enabled: true,
			accelerator: "Alt+Space",
			registered: true,
		});
		api.registered.get("Alt+Space")?.();
		expect(onPress).toHaveBeenCalledOnce();
	});

	it("does not register again when nothing changed", () => {
		const api = fakeApi();
		const m = new ShortcutManager(api, vi.fn());
		m.apply({ enabled: true, shortcut: "Alt+Space" });
		m.apply({ enabled: true, shortcut: "Alt+Space" });
		expect(api.register).toHaveBeenCalledTimes(1);
	});

	it("reports a shortcut taken by another app", () => {
		const api = fakeApi(["Alt+Space"]);
		const m = new ShortcutManager(api, vi.fn());
		const st = m.apply({ enabled: true, shortcut: "Alt+Space" });
		expect(st).toMatchObject({ registered: false, error: QUICK_ASK_IN_USE });
		expect(QUICK_ASK_IN_USE).toBe("That shortcut is in use by another app.");
	});

	it("retries after a failure and clears the error on success", () => {
		const api = fakeApi(["Alt+Space"]);
		const m = new ShortcutManager(api, vi.fn());
		m.apply({ enabled: true, shortcut: "Alt+Space" });
		const st = m.apply({ enabled: true, shortcut: "Ctrl+Shift+Space" });
		expect(st).toEqual({ enabled: true, accelerator: "Ctrl+Shift+Space", registered: true });
	});

	it("treats a throwing register as a failure", () => {
		const m = new ShortcutManager(
			{
				register: () => {
					throw new Error("bad accelerator");
				},
				unregister: vi.fn(),
			},
			vi.fn(),
		);
		expect(m.apply({ enabled: true, shortcut: "Alt+Space" }).registered).toBe(false);
	});

	it("unregisters when disabled and when switching shortcut", () => {
		const api = fakeApi();
		const m = new ShortcutManager(api, vi.fn());
		m.apply({ enabled: true, shortcut: "Alt+Space" });
		m.apply({ enabled: true, shortcut: "Ctrl+Shift+Space" });
		expect([...api.registered.keys()]).toEqual(["Ctrl+Shift+Space"]);
		const st = m.apply({ enabled: false, shortcut: "Ctrl+Shift+Space" });
		expect(st).toMatchObject({ enabled: false, registered: false });
		expect(api.registered.size).toBe(0);
	});

	it("unregisters on dispose", () => {
		const api = fakeApi();
		const m = new ShortcutManager(api, vi.fn());
		m.apply({ enabled: true, shortcut: "Alt+Space" });
		m.dispose();
		expect(api.registered.size).toBe(0);
		expect(m.status().registered).toBe(false);
	});
});

describe("quick ask bounds", () => {
	const area = { x: 0, y: 0, width: 1920, height: 1080 };
	it("centers horizontally in the upper part of the display", () => {
		const b = quickAskBounds(area, 64);
		expect(b.width).toBe(640);
		expect(b.x).toBe(640);
		expect(b.y).toBe(216);
		expect(b.y).toBeLessThan(area.height / 3);
	});
	it("follows the display it opens on", () => {
		const second = { x: 1920, y: 100, width: 1280, height: 800 };
		const b = quickAskBounds(second, 64);
		expect(b.x).toBe(1920 + 320);
		expect(b.y).toBe(100 + 160);
	});
	it("stays on screen on small displays", () => {
		const small = { x: 0, y: 0, width: 500, height: 400 };
		const b = quickAskBounds(small, 560);
		expect(b.width).toBe(500);
		expect(b.y + b.height).toBeLessThanOrEqual(400);
	});
	it("slides a growing window up instead of off the bottom", () => {
		const b = keepOnScreen({ x: 100, y: 800, width: 640, height: 400 }, area);
		expect(b.y).toBe(680);
		expect(keepOnScreen({ x: 100, y: 200, width: 640, height: 400 }, area).y).toBe(200);
	});
	it("clamps height", () => {
		expect(clampHeight(10)).toBe(QUICK_ASK_MIN_HEIGHT);
		expect(clampHeight(9999)).toBe(QUICK_ASK_MAX_HEIGHT);
		expect(clampHeight(100.2)).toBe(101);
		expect(clampHeight(Number.NaN)).toBe(QUICK_ASK_MIN_HEIGHT);
	});
});
