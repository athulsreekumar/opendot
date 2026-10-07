// Shape of a built-in skill. Built-ins ship as TypeScript modules (no loose files to package) and are read-only.
export interface BuiltinSkill {
	/** "builtin:<domain>-<slug>" or "builtin:<slug>" for shared skills. */
	id: string;
	name: string;
	/** One line the Dot sees in its skill list. */
	description: string;
	/** Omitted for shared skills. */
	domain?: string;
	/** Markdown playbook, 120 to 300 words. */
	body: string;
}
