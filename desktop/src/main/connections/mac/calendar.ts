import { defineTool, type ToolDefinition, Type } from "../../runtime/pi-adapter";
import type { MacDeps } from "./deps";
import { jsString, runJxaJson, textResult } from "./jxa";

function parseDate(label: string, v: string): string {
	const d = new Date(v);
	if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${label} date: ${v}`);
	return d.toISOString();
}

export function calendarTools(deps: MacDeps): ToolDefinition[] {
	const events = defineTool({
		name: "mac_calendar_events",
		label: "Calendar events",
		description: "List Calendar.app events between two ISO date-times.",
		parameters: Type.Object({
			from: Type.String({ description: "ISO start" }),
			to: Type.String({ description: "ISO end" }),
		}),
		annotations: { readOnlyHint: true, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const app = Application("Calendar");
const from = new Date(${jsString(parseDate("from", p.from))});
const to = new Date(${jsString(parseDate("to", p.to))});
const out = [];
for (const cal of app.calendars()) {
  const evs = cal.events.whose({_and:[{startDate:{_greaterThan:from}},{startDate:{_lessThan:to}}]})();
  for (const e of evs) {
    out.push({id:e.uid(), title:e.summary(), start:e.startDate().toISOString(), end:e.endDate().toISOString(), calendar:cal.name(), location:e.location()||"", allDay:e.alldayEvent()});
  }
}
out.sort((a,b)=>a.start<b.start?-1:1);
return JSON.stringify(out);
})()`;
			const list = await runJxaJson<unknown[]>(deps.runJxa, script, "Calendar");
			return textResult(JSON.stringify(list), { count: list.length });
		},
	});
	const create = defineTool({
		name: "mac_calendar_create",
		label: "Create calendar event",
		description: "Create an event in Calendar.app.",
		parameters: Type.Object({
			title: Type.String(),
			start: Type.String({ description: "ISO start" }),
			end: Type.String({ description: "ISO end" }),
			calendar: Type.Optional(Type.String({ description: "Calendar name; default calendar if omitted" })),
		}),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		async execute(_id, p) {
			const script = `(function(){
const app = Application("Calendar");
const name = ${jsString(p.calendar ?? null)};
const cal = name === null ? app.calendars()[0] : app.calendars.byName(name);
const ev = app.Event({summary:${jsString(p.title)}, startDate:new Date(${jsString(parseDate("start", p.start))}), endDate:new Date(${jsString(parseDate("end", p.end))})});
cal.events.push(ev);
return JSON.stringify({ok:true, id:ev.uid(), calendar:cal.name()});
})()`;
			const r = await runJxaJson<{ id: string; calendar: string }>(deps.runJxa, script, "Calendar");
			return textResult(`Created event "${p.title}" in ${r.calendar}.`, r);
		},
	});
	return [events, create] as unknown as ToolDefinition[];
}
