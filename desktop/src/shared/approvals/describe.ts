// Plain-language descriptions of tool calls for the approvals inbox. Pure and shared by main and renderer.

export interface EditableField {
	/** The argument key the edited value is written back to. */
	key: string;
	label: string;
	value: string;
	multiline: boolean;
	/** The original argument was a list of strings (for example several recipients). */
	list?: boolean;
}

export type ApprovalDetail =
	| { kind: "email"; to: string; cc?: string; subject: string; body: string; fields: EditableField[] }
	| { kind: "shell"; command: string; fields: EditableField[] }
	| {
			kind: "file";
			operation: "write" | "edit" | "read" | "delete";
			path: string;
			preview: string;
			previewTruncated: boolean;
			fields: EditableField[];
	  }
	| { kind: "message"; to?: string; text: string; fields: EditableField[] }
	| { kind: "json"; json: string; fields: EditableField[] };

const PREVIEW_LINES = 40;
const PREVIEW_CHARS = 4000;

const SPECIAL: Record<string, string> = {
	bash: "Run a command",
	powershell: "Run a command",
	write: "Write a file",
	edit: "Edit a file",
	read: "Read a file",
	ls: "List a folder",
	grep: "Search files",
	find: "Find files",
	message_dot: "Message another Dot",
	ask_dots: "Ask other Dots",
	codemode: "Run a script",
};

const VERBS: Record<string, string> = {
	send: "Send",
	reply: "Reply to",
	forward: "Forward",
	delete: "Delete",
	remove: "Remove",
	trash: "Delete",
	create: "Create",
	add: "Add",
	update: "Update",
	edit: "Edit",
	write: "Write",
	move: "Move",
	rename: "Rename",
	copy: "Copy",
	share: "Share",
	post: "Post",
	publish: "Publish",
	upload: "Upload",
	download: "Download",
	run: "Run",
	execute: "Run",
	open: "Open",
	click: "Click",
	type: "Type",
	set: "Change",
	cancel: "Cancel",
	archive: "Archive",
	label: "Label",
	schedule: "Schedule",
	book: "Book",
	pay: "Pay",
	buy: "Buy",
	read: "Read",
	get: "Get",
	list: "List",
	search: "Search",
	find: "Find",
	fetch: "Fetch",
};

const EMAIL_WORDS = new Set(["email", "emails", "mail", "gmail", "outlook"]);
const MESSAGE_WORDS = new Set([
	"message",
	"messages",
	"msg",
	"dm",
	"chat",
	"text",
	"sms",
	"whatsapp",
	"telegram",
	"slack",
]);
const MASS_NOUNS = new Set(["everything", "all", "anything", "data", "files", "emails", "messages", "events", "items"]);

function stripPrefix(name: string): { server?: string; tokens: string[] } {
	const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
	if (mcp) return { server: mcp[1], tokens: mcp[2]!.split(/[_\-\s]+/).filter(Boolean) };
	return { tokens: name.split(/[_\-\s]+/).filter(Boolean) };
}

const article = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");

/** "mcp__gmail__send_message" -> "Send an email", "delete_file" -> "Delete a file", "bash" -> "Run a command". */
export function humanizeTool(name: string): string {
	if (SPECIAL[name]) return SPECIAL[name];
	const { server, tokens } = stripPrefix(name);
	let lower = tokens.map((t) => t.toLowerCase());
	const serverWords = (server ?? "")
		.toLowerCase()
		.split(/[_\-\s]+/)
		.filter(Boolean);
	// "gmail_reply", "slack_post_message": a leading service name before the verb.
	if (lower.length > 1 && !VERBS[lower[0]!] && VERBS[lower[1]!]) {
		serverWords.push(lower[0]!);
		lower = lower.slice(1);
	}
	const verbWord = lower[0] ?? "";
	const rest = lower.slice(1);
	const mailish = [...serverWords, ...lower].some((w) => EMAIL_WORDS.has(w));
	const verb = VERBS[verbWord];

	// "send_message" on a mail server is still an email; "send_email", "reply", "forward", "create_draft" too.
	if (mailish || (rest.length === 0 && ["reply", "forward"].includes(verbWord) && !server)) {
		if (verbWord === "send" || (verbWord === "create" && rest.includes("draft")) || verbWord === "draft") {
			return verbWord === "send" ? "Send an email" : "Create an email draft";
		}
		if (verbWord === "reply") return "Reply to an email";
		if (verbWord === "forward") return "Forward an email";
		if (verbWord === "delete" || verbWord === "trash") return "Delete an email";
	}
	if (verb && rest.length === 0) {
		const target = serverWords.join(" ");
		return target ? `${verb} in ${cap(target)}` : verb;
	}
	if (verb) {
		const nounPhrase = rest.join(" ");
		const single = rest.length === 1 && !MASS_NOUNS.has(rest[0]!) && !rest[0]!.endsWith("s");
		if (verbWord === "reply" || verbWord === "forward")
			return `${verb} ${single ? `${article(rest[0]!)} ` : ""}${nounPhrase}`;
		if (MESSAGE_WORDS.has(rest[rest.length - 1] ?? "") && verbWord === "send") return "Send a message";
		return `${verb} ${single ? `${article(rest[0]!)} ` : ""}${nounPhrase}`;
	}
	const words = [...tokens];
	return cap(words.join(" ").toLowerCase());
}

function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function lowerFirst(s: string): string {
	return /^[A-Z][a-z]/.test(s) || s.length === 1 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** "Inbox wants to send an email". */
export function approvalTitle(dotName: string, toolName: string): string {
	return `${dotName} wants to ${lowerFirst(humanizeTool(toolName))}`;
}

type Args = Record<string, unknown>;

function asArgs(args: unknown): Args {
	return args && typeof args === "object" && !Array.isArray(args) ? (args as Args) : {};
}

function firstKey(a: Args, keys: string[]): string | undefined {
	return keys.find((k) => a[k] !== undefined && a[k] !== null && (typeof a[k] === "string" || Array.isArray(a[k])));
}

function strValue(v: unknown): string {
	if (typeof v === "string") return v;
	if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(", ");
	return v === undefined || v === null ? "" : JSON.stringify(v);
}

function clip(text: string): { text: string; truncated: boolean } {
	const lines = text.split("\n");
	let out = lines.slice(0, PREVIEW_LINES).join("\n");
	let truncated = lines.length > PREVIEW_LINES;
	if (out.length > PREVIEW_CHARS) {
		out = out.slice(0, PREVIEW_CHARS);
		truncated = true;
	}
	return { text: out, truncated };
}

const TO_KEYS = ["to", "recipient", "recipients", "to_address", "toAddress"];
const SUBJECT_KEYS = ["subject", "title"];
const BODY_KEYS = ["body", "text", "message", "content", "html", "plain_body"];

function field(a: Args, key: string | undefined, label: string, multiline: boolean): EditableField[] {
	if (!key) return [];
	return [{ key, label, value: strValue(a[key]), multiline, list: Array.isArray(a[key]) || undefined }];
}

/** Readable form of a tool call's arguments, plus which of them the user may edit before allowing. */
export function formatApprovalDetail(toolName: string, args: unknown): ApprovalDetail {
	const a = asArgs(args);
	const human = humanizeTool(toolName);
	const toKey = firstKey(a, TO_KEYS);
	const subjectKey = firstKey(a, SUBJECT_KEYS);
	const bodyKey = firstKey(a, BODY_KEYS);

	const isEmail =
		/email|draft/i.test(human) || (toKey !== undefined && (subjectKey !== undefined || bodyKey !== undefined));
	if (isEmail && (toKey || subjectKey || bodyKey)) {
		const ccKey = firstKey(a, ["cc"]);
		const fields = [
			...field(a, toKey, "To", false),
			...field(a, ccKey, "Cc", false),
			...field(a, subjectKey, "Subject", false),
			...field(a, bodyKey, "Message", true),
		];
		return {
			kind: "email",
			to: toKey ? strValue(a[toKey]) : "",
			cc: ccKey ? strValue(a[ccKey]) : undefined,
			subject: subjectKey ? strValue(a[subjectKey]) : "",
			body: bodyKey ? strValue(a[bodyKey]) : "",
			fields,
		};
	}

	if (
		toolName === "bash" ||
		toolName === "powershell" ||
		(typeof a.command === "string" && /run|execute|shell/i.test(human))
	) {
		const key = firstKey(a, ["command", "cmd", "script"]);
		return { kind: "shell", command: key ? strValue(a[key]) : "", fields: field(a, key, "Command", true) };
	}

	const pathKey = firstKey(a, ["path", "file", "file_path", "filepath", "filename"]);
	if (pathKey && ["write", "edit", "read"].includes(toolName)) {
		const operation = toolName as "write" | "edit" | "read";
		if (operation === "write") {
			const contentKey = firstKey(a, ["content", "text"]);
			const { text, truncated } = clip(contentKey ? strValue(a[contentKey]) : "");
			return {
				kind: "file",
				operation,
				path: strValue(a[pathKey]),
				preview: text,
				previewTruncated: truncated,
				fields: field(a, contentKey, "File content", true),
			};
		}
		if (operation === "edit") {
			const edits = Array.isArray(a.edits) ? (a.edits as Array<{ oldText?: unknown; newText?: unknown }>) : [];
			const preview = edits.map((e) => `- ${strValue(e.oldText)}\n+ ${strValue(e.newText)}`).join("\n\n");
			const { text, truncated } = clip(preview);
			return {
				kind: "file",
				operation,
				path: strValue(a[pathKey]),
				preview: text,
				previewTruncated: truncated,
				fields: [],
			};
		}
		return { kind: "file", operation, path: strValue(a[pathKey]), preview: "", previewTruncated: false, fields: [] };
	}
	if (pathKey && /^delete|^remove|^trash/.test(human.toLowerCase())) {
		return {
			kind: "file",
			operation: "delete",
			path: strValue(a[pathKey]),
			preview: "",
			previewTruncated: false,
			fields: [],
		};
	}

	const textKey = firstKey(a, ["text", "message", "body", "content"]);
	if (
		textKey &&
		(MESSAGE_WORDS.has(lowerWords(toolName).find((w) => MESSAGE_WORDS.has(w)) ?? "") || a.chatId !== undefined)
	) {
		const toK = firstKey(a, ["chatId", "channel", "to", "recipient"]);
		return {
			kind: "message",
			to: toK ? strValue(a[toK]) : undefined,
			text: strValue(a[textKey]),
			fields: field(a, textKey, "Message", true),
		};
	}

	return { kind: "json", json: JSON.stringify(args ?? {}, null, 2), fields: [] };
}

function lowerWords(name: string): string[] {
	return name
		.toLowerCase()
		.split(/[_\-\s]+/)
		.filter(Boolean);
}

/** Apply edited field values on top of the original arguments (same keys, list fields stay lists). */
export function applyEdits(args: unknown, fields: EditableField[], values: Record<string, string>): Args {
	const out: Args = { ...asArgs(args) };
	for (const f of fields) {
		const v = values[f.key];
		if (v === undefined) continue;
		out[f.key] = f.list
			? v
					.split(/[,;\n]/)
					.map((x) => x.trim())
					.filter(Boolean)
			: v;
	}
	return out;
}

/** Keys whose value differs between the original and the edited arguments. */
export function changedKeys(before: unknown, after: unknown): string[] {
	const a = asArgs(before);
	const b = asArgs(after);
	return Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

/** One short line for history and logs: what, with a few identifying bits. Callers mask PII before storing it. */
export function summarizeApproval(toolName: string, args: unknown): string {
	const d = formatApprovalDetail(toolName, args);
	const what = humanizeTool(toolName);
	const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
	const one = (s: string) => s.replace(/\s+/g, " ").trim();
	switch (d.kind) {
		case "email":
			return d.subject ? `${what}: ${cut(one(d.subject), 70)}` : what;
		case "shell":
			return d.command ? `${what}: ${cut(one(d.command), 70)}` : what;
		case "file":
			return d.path ? `${what}: ${cut(basename(d.path), 70)}` : what;
		default:
			return what;
	}
}

function basename(p: string): string {
	const parts = p.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] ?? p;
}
