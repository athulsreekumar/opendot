// Scripted model for tests and e2e (spec 04 §6). Wraps pi-ai's built-in faux provider.
// Enabled only when OPENDOT_FAKE_PROVIDER=1.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAttachmentBlocks } from "../../shared/attachments";
import { type AssistantMessage, fauxAssistantMessage, fauxProvider, type ModelRuntime } from "../runtime/pi-adapter";

export const FAKE_PROVIDER_ID = "opendot-fake";
export const FAKE_MODEL_ID = "fake-1";

type Faux = ReturnType<typeof fauxProvider>;
type Step = Parameters<Faux["setResponses"]>[0][number];
type FauxContent = Parameters<typeof fauxAssistantMessage>[0];

interface ScriptStep {
	content?: FauxContent;
	stopReason?: AssistantMessage["stopReason"];
	errorMessage?: string;
}
/** A reply chosen by which Dot is asking (matched on "You are <Name>," in the system prompt). Lets parallel fan-outs be scripted. */
interface ByDotStep {
	byDot: Record<string, string>;
}
/**
 * An Organisation task reply that also writes a file into the asking Dot's workspace folder for the task (the folder
 * named in the prompt: projects/<projectId>/<taskId>/). Lets e2e tests produce deliverables without a tool call.
 */
interface DeliverStep {
	deliver: { file: string; content: string; text: string };
}
/** In a script, replaced by the `prj_...` id found in the latest prompt (see ProjectService planner prompt). */
const PROJECT_ID_TOKEN = "$PROJECT_ID";
type ScriptEntry = ScriptStep | ByDotStep | DeliverStep | "$capture" | "$echo" | "$long" | "$toolresult";

/** The Dot's name from its system prompt ("You are Inbox, one of …"). */
export function dotNameFromSystemPrompt(systemPrompt: unknown): string | undefined {
	return /You are ([^,.\n]+?),/.exec(typeof systemPrompt === "string" ? systemPrompt : "")?.[1]?.trim();
}

/** The system text of a model context: `systemPrompt`, or the leading system message (content + sections). */
export function systemTextOf(context: unknown): string {
	const c = context as {
		systemPrompt?: unknown;
		messages?: Array<{ role?: string; content?: unknown; sections?: Record<string, unknown> }>;
	};
	if (typeof c.systemPrompt === "string" && c.systemPrompt) return c.systemPrompt;
	const sys = c.messages?.find((m) => m.role === "system");
	if (!sys) return "";
	const parts = [typeof sys.content === "string" ? sys.content : "", ...Object.values(sys.sections ?? {})];
	return parts.filter((p): p is string => typeof p === "string").join("\n");
}

export function pickByDot(byDot: Record<string, string>, systemPrompt: unknown): string {
	const name = dotNameFromSystemPrompt(systemPrompt);
	return (name && byDot[name]) || byDot["*"] || "";
}

export class FakeProvider {
	readonly faux: Faux;
	readonly captured: string[] = [];
	private scriptsDir: string;

	constructor(runtime: ModelRuntime, scriptsDir: string) {
		this.scriptsDir = scriptsDir;
		this.faux = fauxProvider({
			provider: FAKE_PROVIDER_ID,
			models: [{ id: FAKE_MODEL_ID, name: "Fake (tests)", contextWindow: 200000, maxTokens: 8000 }],
			tokensPerSecond: Number(process.env.OPENDOT_FAKE_TPS ?? 400),
		});
		runtime.registerNativeProvider(this.faux.provider);
		this.reset();
	}

	/** Replace pending responses with the named script; an endless echo follows it. */
	setScript(name: string): void {
		this.faux.setResponses([...this.load(name), this.echoForever()]);
	}

	/** Queue a script after what's pending (before the trailing echo). */
	appendScript(name: string): void {
		this.faux.setResponses([...this.load(name), this.echoForever()]);
	}

	reset(): void {
		const initial = process.env.OPENDOT_FAKE_SCRIPT;
		if (initial) this.setScript(initial);
		else this.faux.setResponses([this.echoForever()]);
	}

	private load(name: string): Step[] {
		const file = join(this.scriptsDir, `${name.replace(/[^a-z0-9-]/gi, "")}.json`);
		const json = JSON.parse(readFileSync(file, "utf8")) as { steps: ScriptEntry[] };
		return json.steps.map((s) => this.toStep(s));
	}

	private toStep(s: ScriptEntry): Step {
		if (s === "$capture") {
			return (context) => {
				this.captured.push(JSON.stringify(context));
				return fauxAssistantMessage("ok");
			};
		}
		if (s === "$echo") return (context) => fauxAssistantMessage(`You said: ${lastUserText(context)}`);
		if (s === "$toolresult") return (context) => fauxAssistantMessage(`The tool said: ${lastToolResultText(context)}`);
		if (s === "$long") return fauxAssistantMessage(longMarkdown());
		if ("deliver" in s) {
			const d = s.deliver;
			return (context) => {
				writeTaskFile(systemTextOf(context), lastUserText(context), d.file, d.content);
				return fauxAssistantMessage(d.text);
			};
		}
		if ("byDot" in s) {
			const byDot = s.byDot;
			return (context) => fauxAssistantMessage(pickByDot(byDot, systemTextOf(context)));
		}
		if (JSON.stringify(s.content ?? "").includes(PROJECT_ID_TOKEN)) {
			// Tool-call arguments that name the Organisation project the prompt is about (its id is only known at run time).
			const step = s;
			return (context) => {
				const id = /prj_[A-Za-z0-9]+/.exec(lastUserText(context))?.[0] ?? "";
				const content = JSON.parse(JSON.stringify(step.content).split(PROJECT_ID_TOKEN).join(id)) as FauxContent;
				return fauxAssistantMessage(content, {
					...(step.stopReason ? { stopReason: step.stopReason } : {}),
				});
			};
		}
		return fauxAssistantMessage(s.content ?? "", {
			...(s.stopReason ? { stopReason: s.stopReason } : {}),
			...(s.errorMessage ? { errorMessage: s.errorMessage } : {}),
		});
	}

	private echoForever(): Step {
		return (context) => {
			this.faux.appendResponses([this.echoForever()]);
			const text = parseAttachmentBlocks(lastUserText(context)).text;
			const seen = lastUserImageCount(context);
			return fauxAssistantMessage(
				text.startsWith("[OpenDot")
					? "[UPDATE] Got your events (fake model)."
					: `You said: ${text}\n\nI'm the **fake test model**, so I just echo. Add a real model in Settings → Models.${seen ? `\n\n(Fake model received ${seen} image${seen === 1 ? "" : "s"}.)` : ""}`,
			);
		};
	}
}

/** Writes `file` into the workspace of the Dot named in the system prompt, under the task folder found in the prompt. */
function writeTaskFile(systemText: string, prompt: string, file: string, content: string): void {
	const m = /projects\/(prj_[A-Za-z0-9]+)\/([A-Za-z0-9_-]+)\//.exec(prompt);
	const name = dotNameFromSystemPrompt(systemText);
	const root = process.env.OPENDOT_DATA_DIR;
	if (!m || !name || !root) return;
	const dotsDir = join(root, "dots");
	for (const dir of readdirSync(dotsDir)) {
		try {
			const raw = JSON.parse(readFileSync(join(dotsDir, dir, "dot.json"), "utf8")) as {
				data?: { name?: string; workspaceDir?: string };
			};
			if (raw.data?.name !== name || !raw.data.workspaceDir) continue;
			const folder = join(raw.data.workspaceDir, "projects", m[1]!, m[2]!);
			mkdirSync(folder, { recursive: true });
			writeFileSync(join(folder, file), content);
			return;
		} catch {
			// not a Dot folder
		}
	}
}

function lastUserText(context: unknown): string {
	const msgs = (context as { messages?: Array<{ role: string; content: unknown }> }).messages ?? [];
	for (let i = msgs.length - 1; i >= 0; i--) {
		const m = msgs[i]!;
		if (m.role !== "user" && m.role !== "custom") continue;
		if (typeof m.content === "string") return m.content;
		if (Array.isArray(m.content)) {
			return m.content
				.filter((b: { type?: string }) => b.type === "text")
				.map((b: { text?: string }) => b.text ?? "")
				.join("");
		}
	}
	return "";
}

/** Text of the most recent tool result in the context (what the last tool call returned or why it was blocked). */
function lastToolResultText(context: unknown): string {
	const msgs = (context as { messages?: Array<{ role: string; content: unknown }> }).messages ?? [];
	for (let i = msgs.length - 1; i >= 0; i--) {
		const m = msgs[i]!;
		if (m.role !== "toolResult") continue;
		if (typeof m.content === "string") return m.content;
		if (Array.isArray(m.content)) {
			return m.content
				.filter((b: { type?: string }) => b.type === "text")
				.map((b: { text?: string }) => b.text ?? "")
				.join(" ");
		}
	}
	return "";
}

/** Number of image blocks in the last user message (attachments tests). */
export function lastUserImageCount(context: unknown): number {
	const msgs = (context as { messages?: Array<{ role: string; content: unknown }> }).messages ?? [];
	for (let i = msgs.length - 1; i >= 0; i--) {
		const m = msgs[i]!;
		if (m.role !== "user") continue;
		return Array.isArray(m.content) ? m.content.filter((b: { type?: string }) => b.type === "image").length : 0;
	}
	return 0;
}

/** ~10k characters of markdown with code fences, for streaming tests. */
export function longMarkdown(): string {
	const parts: string[] = ["# Streaming test\n"];
	for (let i = 1; i <= 24; i++) {
		parts.push(
			`## Section ${i}\n\nThis is paragraph ${i}. It has **bold**, _italic_ and \`inline code\` so the renderer has real work to do while tokens arrive one by one.\n`,
		);
		if (i % 6 === 0)
			parts.push("```ts\nexport function add(a: number, b: number): number {\n\treturn a + b;\n}\n```\n");
		parts.push(`- point ${i}.1\n- point ${i}.2\n`);
	}
	return parts.join("\n");
}
