// OneDrive watcher (spec 12 §4): drive delta, deltaLink is the cursor.
import { z } from "zod";
import { graphJson } from "../../connections/microsoft/client";
import type { NewEvent, WatcherSource } from "../types";
import { drainDelta, graphDeps } from "./outlook-mail";

interface Item {
	id: string;
	name?: string;
	folder?: unknown;
	root?: unknown;
	deleted?: unknown;
	"@removed"?: unknown;
	lastModifiedDateTime?: string;
	lastModifiedBy?: { user?: { displayName?: string } };
	parentReference?: { path?: string };
}

const configSchema = z.object({ path: z.string().optional() });
type Config = z.infer<typeof configSchema>;

const START = "/me/drive/root/delta";

function inPath(it: Item, path: string | undefined): boolean {
	if (!path) return true;
	const want = `/${path.replace(/^\/+|\/+$/g, "")}`;
	const parent = (it.parentReference?.path ?? "").replace(/^\/drive\/root:/, "");
	return parent === want || parent.startsWith(`${want}/`);
}

function toEvent(it: Item): NewEvent {
	const by = it.lastModifiedBy?.user?.displayName;
	return {
		title: `File updated: ${it.name}${by ? ` (by ${by})` : ""}`,
		body: it.name ?? "",
		facts: {
			name: it.name ?? "",
			itemId: it.id,
			...(by ? { modifiedBy: by } : {}),
			path: (it.parentReference?.path ?? "").replace(/^\/drive\/root:/, "") || "/",
		},
		dedupeKey: `${it.id}:${it.lastModifiedDateTime ?? ""}`,
		importanceHint: "low",
		occurredAt: it.lastModifiedDateTime ?? new Date().toISOString(),
	};
}

const isFile = (it: Item) => !it.folder && !it.root && !it.deleted && !it["@removed"] && !!it.name;

export const onedriveSource: WatcherSource<Config> = {
	type: "onedrive",
	label: "OneDrive",
	requires: { connectionType: "microsoft", feature: "onedrive" },
	configSchema,
	defaultIntervalSec: 120,
	minIntervalSec: 60,
	async poll(ctx, cursor) {
		const g = graphDeps(ctx.deps);
		if (!cursor) {
			const { deltaLink } = await drainDelta<Item>(g, START, START);
			return { events: [], cursor: deltaLink };
		}
		const { items, deltaLink, reset } = await drainDelta<Item>(g, cursor, START);
		const events = reset ? [] : items.filter((it) => isFile(it) && inPath(it, ctx.config.path)).map(toEvent);
		return { events, cursor: deltaLink ?? cursor };
	},
	async test(ctx) {
		try {
			const data = await graphJson<{ value?: Item[] }>(graphDeps(ctx.deps), "/me/drive/root/children?$top=10");
			const sample = (data.value ?? [])
				.filter((it) => isFile(it) && inPath(it, ctx.config.path))
				.slice(0, 3)
				.map(toEvent);
			return { ok: true, message: "Connected to OneDrive.", sample };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
