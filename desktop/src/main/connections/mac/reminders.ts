import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";
import { jsString, runJxaJson, textResult } from "./jxa";

export function remindersTools(deps: MacDeps): ToolDefinition[] {
	const list = defineTool({
		name: "mac_reminders_list",
		label: "List reminders",
		description: "List incomplete reminders, optionally from one list.",
		parameters: Type.Object({ list: Type.Optional(Type.String()) }),
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const app = Application("Reminders");
const only = ${jsString(p.list ?? null)};
const lists = only === null ? app.lists() : [app.lists.byName(only)];
const out = [];
for (const l of lists) {
  for (const r of l.reminders.whose({completed:false})()) {
    const d = r.dueDate();
    out.push({id:r.id(), title:r.name(), due:d?d.toISOString():null, list:l.name(), notes:r.body()||""});
  }
}
return JSON.stringify(out);
})()`;
			const items = await runJxaJson<unknown[]>(deps.runJxa, script, "Reminders");
			return textResult(JSON.stringify(items), { count: items.length });
		},
	});
	const add = defineTool({
		name: "mac_reminders_add",
		label: "Add reminder",
		description: "Add a reminder.",
		parameters: Type.Object({
			title: Type.String(),
			due: Type.Optional(Type.String({ description: "ISO due date-time" })),
			list: Type.Optional(Type.String()),
		}),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		async execute(_id, p) {
			let due: string | null = null;
			if (p.due) {
				const d = new Date(p.due);
				if (Number.isNaN(d.getTime())) throw new Error(`Invalid due date: ${p.due}`);
				due = d.toISOString();
			}
			const script = `(function(){
const app = Application("Reminders");
const name = ${jsString(p.list ?? null)};
const l = name === null ? app.defaultList() : app.lists.byName(name);
const due = ${jsString(due)};
const props = {name:${jsString(p.title)}};
if (due !== null) props.dueDate = new Date(due);
const r = app.Reminder(props);
l.reminders.push(r);
return JSON.stringify({ok:true, id:r.id(), list:l.name()});
})()`;
			const r = await runJxaJson<{ id: string; list: string }>(deps.runJxa, script, "Reminders");
			return textResult(`Added reminder "${p.title}" to ${r.list}.`, r);
		},
	});
	const complete = defineTool({
		name: "mac_reminders_complete",
		label: "Complete reminder",
		description: "Mark a reminder complete by id.",
		parameters: Type.Object({ id: Type.String() }),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const app = Application("Reminders");
const r = app.reminders.byId(${jsString(p.id)});
r.completed = true;
return JSON.stringify({ok:true, title:r.name()});
})()`;
			const r = await runJxaJson<{ title: string }>(deps.runJxa, script, "Reminders");
			return textResult(`Completed reminder "${r.title}".`, r);
		},
	});
	return [list, add, complete] as unknown as ToolDefinition[];
}
