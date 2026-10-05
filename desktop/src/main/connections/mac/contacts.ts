import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";
import { jsString, runJxaJson, textResult } from "./jxa";

export function contactsTools(deps: MacDeps): ToolDefinition[] {
	const search = defineTool({
		name: "mac_contacts_search",
		label: "Search contacts",
		description: "Search Contacts.app by name.",
		parameters: Type.Object({ query: Type.String() }),
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const app = Application("Contacts");
const q = ${jsString(p.query)};
const out = [];
for (const c of app.people.whose({name:{_contains:q}})().slice(0, 25)) {
  out.push({id:c.id(), name:c.name(), emails:c.emails().map(e=>e.value()), phones:c.phones().map(x=>x.value()), organization:c.organization()||""});
}
return JSON.stringify(out);
})()`;
			const items = await runJxaJson<unknown[]>(deps.runJxa, script, "Contacts");
			return textResult(JSON.stringify(items), { count: items.length });
		},
	});
	return [search] as unknown as ToolDefinition[];
}
