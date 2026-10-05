import { defineTool, Type } from "../../runtime/pi-adapter";
import type { NativeToolDeps } from "../native-types";
import { graphFetch, graphJson, textResult } from "./client";

interface DriveItem {
	id: string;
	name?: string;
	size?: number;
	folder?: unknown;
	lastModifiedDateTime?: string;
	parentReference?: { path?: string };
}

const MAX_READ_BYTES = 1024 * 1024;

export function onedriveTools(deps: NativeToolDeps) {
	const search = defineTool({
		name: "onedrive_search",
		label: "OneDrive · search",
		description: "Search OneDrive files by name or content. Returns: n. name — size — modified — id.",
		parameters: Type.Object({ q: Type.String({ description: "Search text" }) }),
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute(_id, p) {
			const q = p.q.replace(/'/g, "''");
			const data = await graphJson<{ value: DriveItem[] }>(
				deps,
				`/me/drive/root/search(q='${encodeURIComponent(q)}')?$top=20&$select=id,name,size,folder,lastModifiedDateTime,parentReference`,
			);
			const items = data.value ?? [];
			const text = items.length
				? items
						.map(
							(it, i) =>
								`${i + 1}. ${it.name}${it.folder ? "/" : ""} — ${it.folder ? "folder" : `${it.size ?? 0} bytes`} — ${it.lastModifiedDateTime ?? ""} — ${it.id}`,
						)
						.join("\n")
				: "No files found.";
			return textResult(text, { count: items.length });
		},
	});

	const read = defineTool({
		name: "onedrive_read",
		label: "OneDrive · read",
		description: "Read a text file from OneDrive by item id (max 1 MB).",
		parameters: Type.Object({ itemId: Type.String() }),
		annotations: { readOnlyHint: true, openWorldHint: true },
		async execute(_id, p) {
			const meta = await graphJson<DriveItem>(
				deps,
				`/me/drive/items/${encodeURIComponent(p.itemId)}?$select=id,name,size,folder`,
			);
			if (meta.folder) throw new Error(`${meta.name ?? p.itemId} is a folder, not a file.`);
			if ((meta.size ?? 0) > MAX_READ_BYTES)
				throw new Error(`${meta.name ?? p.itemId} is larger than 1 MB; refusing to read it.`);
			const res = await graphFetch(deps, `/me/drive/items/${encodeURIComponent(p.itemId)}/content`, {
				headers: { Accept: "*/*" },
			});
			const buf = Buffer.from(await res.arrayBuffer());
			if (buf.length > MAX_READ_BYTES) throw new Error("File is larger than 1 MB; refusing to read it.");
			if (buf.includes(0)) throw new Error(`${meta.name ?? p.itemId} looks like a binary file, not text.`);
			return textResult(buf.toString("utf8"), { id: meta.id, name: meta.name, bytes: buf.length });
		},
	});

	const create = defineTool({
		name: "onedrive_create_text_file",
		label: "OneDrive · create file",
		description: "Create (or replace) a text file at a OneDrive path, e.g. Documents/notes.txt.",
		parameters: Type.Object({
			path: Type.String({ description: "Path from the OneDrive root" }),
			content: Type.String(),
		}),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		async execute(_id, p) {
			const clean = p.path.replace(/^\/+/, "");
			if (!clean || clean.split("/").some((s) => s === "..")) throw new Error("Invalid OneDrive path.");
			const encoded = clean.split("/").map(encodeURIComponent).join("/");
			const item = await graphJson<DriveItem>(deps, `/me/drive/root:/${encoded}:/content`, {
				method: "PUT",
				headers: { "Content-Type": "text/plain" },
				body: p.content,
			});
			return textResult(`Saved ${clean} (id: ${item.id}).`, { id: item.id });
		},
	});

	return [search, read, create];
}
