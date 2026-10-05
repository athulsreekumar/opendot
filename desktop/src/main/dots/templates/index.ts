import type { DotTemplate } from "@shared/types";
import calendar from "./calendar.json";
import dev from "./dev.json";
import files from "./files.json";
import finance from "./finance.json";
import general from "./general.json";
import inbox from "./inbox.json";
import planner from "./planner.json";
import research from "./research.json";
import super_ from "./super.json";
import wellbeing from "./wellbeing.json";
import writer from "./writer.json";

export const TEMPLATES: DotTemplate[] = [
	general as unknown as DotTemplate,
	inbox as unknown as DotTemplate,
	calendar as unknown as DotTemplate,
	research as unknown as DotTemplate,
	writer as unknown as DotTemplate,
	dev as unknown as DotTemplate,
	finance as unknown as DotTemplate,
	files as unknown as DotTemplate,
	planner as unknown as DotTemplate,
	wellbeing as unknown as DotTemplate,
];

export const SUPER_TEMPLATE = super_ as unknown as DotTemplate;
