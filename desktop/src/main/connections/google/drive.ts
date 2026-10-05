// Google Drive tools. Spec 05 §5.1.
import type { ToolDefinition } from "../../runtime/pi-adapter";
import { defineTool, Type } from "../../runtime/pi-adapter";
import type { NativeToolDeps } from "../native-types";
import { googleFetch, googleFetchRaw, READ_ONLY, textResult, WRITE } from "./client";

export const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const MAX_MEDIA = 1024 * 1024;

interface DriveFile {
	id: string;
	name?: string;
	mimeType?: string;
	modifiedTime?: string;
	size?: string;
	webViewLink?: string;
}

export function driveTools(deps: NativeToolDeps): ToolDefinition[] {
	const search = defineTool({
		name: "drive_search",
		label: "Drive · search",
		description: "Full-text search across Google Drive files.",
		parameters: Type.Object({ query: Type.String({ description: "Text to search for" }) }),
		annotations: READ_ONLY,
		async execute(_id, p) {
			const q = `fullText contains '${p.query.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and trashed = false`;
			const params = new URLSearchParams({
				q,
				pageSize: "15",
				fields: "files(id,name,mimeType,modifiedTime)",
			});
			const r = (await googleFetch(deps, `${DRIVE_BASE}/files?${params}`)) as { files?: DriveFile[] };
			const files = r.files ?? [];
			if (files.length === 0) return textResult("No files found.", { count: 0, items: [] });
			const text = files
				.map(
					(f, i) =>
						`${i + 1}. ${f.name} — ${f.mimeType?.replace("application/vnd.google-apps.", "google ")} — ${f.modifiedTime} — ${f.id}`,
				)
				.join("\n");
			return textResult(text, { count: files.length, items: files });
		},
	});

	const read = defineTool({
		name: "drive_read",
		label: "Drive · read file",
		description:
			"Read a Drive file as text. Docs export as plain text, Sheets as CSV; other files only if text and ≤ 1 MB.",
		parameters: Type.Object({ fileId: Type.String() }),
		annotations: READ_ONLY,
		async execute(_id, p) {
			const id = encodeURIComponent(p.fileId);
			const meta = (await googleFetch(deps, `${DRIVE_BASE}/files/${id}?fields=id,name,mimeType,size`)) as DriveFile;
			const mime = meta.mimeType ?? "";
			let url: string;
			if (mime === "application/vnd.google-apps.document") url = `${DRIVE_BASE}/files/${id}/export?mimeType=text/plain`;
			else if (mime === "application/vnd.google-apps.spreadsheet")
				url = `${DRIVE_BASE}/files/${id}/export?mimeType=text/csv`;
			else if (mime.startsWith("application/vnd.google-apps."))
				throw new Error(`Cannot read Google ${mime.split(".").pop()} files as text`);
			else {
				if (meta.size && Number(meta.size) > MAX_MEDIA)
					throw new Error(`File too large to read (${meta.size} bytes, limit 1 MB)`);
				if (!(mime.startsWith("text/") || /json|xml|csv|javascript|markdown/.test(mime)))
					throw new Error(`Not a text file (${mime})`);
				url = `${DRIVE_BASE}/files/${id}?alt=media`;
			}
			const res = await googleFetchRaw(deps, url);
			const text = await res.text();
			return textResult(`${meta.name}\n\n${text}`, { id: meta.id, name: meta.name, mimeType: mime });
		},
	});

	const create = defineTool({
		name: "drive_create_text_file",
		label: "Drive · create text file",
		description: "Create a plain-text file in Google Drive.",
		parameters: Type.Object({
			name: Type.String(),
			content: Type.String(),
			folderId: Type.Optional(Type.String()),
		}),
		annotations: WRITE,
		async execute(_id, p) {
			const boundary = `opendot${Date.now().toString(36)}`;
			const metadata: Record<string, unknown> = { name: p.name, mimeType: "text/plain" };
			if (p.folderId) metadata.parents = [p.folderId];
			const body =
				`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
				`--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${p.content}\r\n--${boundary}--`;
			const f = (await googleFetch(deps, `${UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink`, {
				method: "POST",
				headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
				body,
			})) as DriveFile;
			return textResult(`Created "${f.name}" — id ${f.id}`, { id: f.id, link: f.webViewLink });
		},
	});

	return [search, read, create] as unknown as ToolDefinition[];
}
