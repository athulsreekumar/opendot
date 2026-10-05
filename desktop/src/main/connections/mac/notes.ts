import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";
import { jsString, runJxaJson, textResult } from "./jxa";

export function notesTools(deps: MacDeps): ToolDefinition[] {
	const search = defineTool({
		name: "mac_notes_search",
		label: "Search notes",
		description: "Search Notes.app by title or text.",
		parameters: Type.Object({ query: Type.String() }),
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const app = Application("Notes");
const q = ${jsString(p.query)};
const out = [];
for (const n of app.notes.whose({_or:[{name:{_contains:q}},{plaintext:{_contains:q}}]})().slice(0, 25)) {
  out.push({id:n.id(), title:n.name(), snippet:n.plaintext().slice(0, 200)});
}
return JSON.stringify(out);
})()`;
			const items = await runJxaJson<unknown[]>(deps.runJxa, script, "Notes");
			return textResult(JSON.stringify(items), { count: items.length });
		},
	});
	const read = defineTool({
		name: "mac_notes_read",
		label: "Read note",
		description: "Read a note's plain text by id.",
		parameters: Type.Object({ id: Type.String() }),
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const n = Application("Notes").notes.byId(${jsString(p.id)});
return JSON.stringify({id:n.id(), title:n.name(), body:n.plaintext()});
})()`;
			const n = await runJxaJson<{ title: string; body: string }>(deps.runJxa, script, "Notes");
			return textResult(`${n.title}\n\n${n.body}`, n);
		},
	});
	const create = defineTool({
		name: "mac_notes_create",
		label: "Create note",
		description: "Create a note in Notes.app.",
		parameters: Type.Object({ title: Type.String(), body: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const app = Application("Notes");
const title = ${jsString(p.title)};
const body = ${jsString(p.body)};
const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\n/g,"<br>");
const n = app.Note({name:title, body:"<div><h1>"+esc(title)+"</h1></div><div>"+esc(body)+"</div>"});
app.defaultAccount().notes.push(n);
return JSON.stringify({ok:true, id:n.id()});
})()`;
			const r = await runJxaJson<{ id: string }>(deps.runJxa, script, "Notes");
			return textResult(`Created note "${p.title}".`, r);
		},
	});
	return [search, read, create] as unknown as ToolDefinition[];
}
