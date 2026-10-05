// Google Drive watcher source (spec 12 §4): changes.list pageToken cursor.
import { z } from "zod";
import type { NewEvent, SourceCtx, WatcherSource } from "../types";

const DRIVE = "https://www.googleapis.com/drive/v3";

const configSchema = z.object({ folderId: z.string().optional() });
type Config = z.infer<typeof configSchema>;

interface Change {
	fileId: string;
	removed?: boolean;
	file?: {
		id: string;
		name?: string;
		mimeType?: string;
		modifiedTime?: string;
		trashed?: boolean;
		parents?: string[];
		lastModifyingUser?: { displayName?: string };
	};
}

async function api<T>(ctx: SourceCtx<Config>, path: string): Promise<T> {
	const token = await ctx.deps.getAccessToken("google");
	const res = await ctx.deps.fetch(`${DRIVE}${path}`, {
		headers: { Authorization: `Bearer ${token}` },
		signal: ctx.signal,
	});
	if (!res.ok) throw new Error(`Drive API error ${res.status}`);
	return (await res.json()) as T;
}

const startToken = async (ctx: SourceCtx<Config>) =>
	(await api<{ startPageToken: string }>(ctx, "/changes/startPageToken")).startPageToken;

const FIELDS =
	"nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,modifiedTime,trashed,parents,lastModifyingUser(displayName)))";

function toEvent(c: Change, now: Date): NewEvent | undefined {
	const f = c.file;
	if (!f || c.removed || f.trashed) return undefined;
	const who = f.lastModifyingUser?.displayName;
	const kind = f.mimeType?.includes("spreadsheet") ? "Sheet" : f.mimeType?.includes("document") ? "Doc" : "File";
	const name = f.name ?? "(untitled)";
	return {
		title: `${kind} updated: ${name}${who ? ` (by ${who})` : ""}`,
		body: "",
		facts: { fileId: f.id, name, ...(who ? { by: who } : {}), ...(f.mimeType ? { mimeType: f.mimeType } : {}) },
		dedupeKey: `${f.id}:${f.modifiedTime ?? ""}`,
		importanceHint: "normal",
		occurredAt: f.modifiedTime ?? now.toISOString(),
	};
}

export const googleDriveSource: WatcherSource<Config> = {
	type: "google-drive",
	label: "Google Drive",
	requires: { connectionType: "google", feature: "drive" },
	configSchema,
	defaultIntervalSec: 120,
	minIntervalSec: 60,
	async poll(ctx, cursor) {
		if (!cursor) return { events: [], cursor: await startToken(ctx) };
		const events: NewEvent[] = [];
		let token = cursor;
		let next = cursor;
		for (let guard = 0; guard < 20; guard++) {
			const q = new URLSearchParams({ pageToken: token, fields: FIELDS, pageSize: "100", includeRemoved: "true" });
			const r = await api<{ changes?: Change[]; nextPageToken?: string; newStartPageToken?: string }>(
				ctx,
				`/changes?${q}`,
			);
			for (const c of r.changes ?? []) {
				if (ctx.config.folderId && !c.file?.parents?.includes(ctx.config.folderId)) continue;
				const e = toEvent(c, ctx.deps.now());
				if (e) events.push(e);
			}
			if (r.nextPageToken) {
				token = r.nextPageToken;
				next = token;
				continue;
			}
			next = r.newStartPageToken ?? token;
			break;
		}
		return { events, cursor: next };
	},
	async test(ctx) {
		try {
			const q = new URLSearchParams({
				pageSize: "3",
				orderBy: "modifiedTime desc",
				fields: "files(id,name,mimeType,modifiedTime)",
			});
			if (ctx.config.folderId) q.set("q", `'${ctx.config.folderId}' in parents and trashed = false`);
			const r = await api<{ files?: Array<{ id: string; name: string; modifiedTime?: string }> }>(ctx, `/files?${q}`);
			const now = ctx.deps.now();
			const sample = (r.files ?? []).map((f) => ({
				title: f.name,
				body: "",
				facts: { fileId: f.id, name: f.name },
				dedupeKey: `${f.id}:${f.modifiedTime ?? ""}`,
				importanceHint: "low" as const,
				occurredAt: f.modifiedTime ?? now.toISOString(),
			}));
			return { ok: true, message: `Connected. ${sample.length} recent file(s).`, sample };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e), sample: [] };
		}
	},
};
