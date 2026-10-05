// Per-turn prompt sections (spec 08 §3 "static vs dynamic"): now, privacy, memory, about_user, capabilities, always_on, your_dots.
import type { Dot } from "../../../shared/types";
import { MemoryService } from "../../memory/memory-service";
import type { InlineExtension } from "../pi-adapter";
import { alwaysOnSection, nowSection, PRIVACY_SECTION } from "../system-prompt";

export interface SectionDeps {
	getDot: () => Promise<Dot>;
	shouldRedact: () => Promise<boolean>;
	memory: MemoryService;
	capabilities: (dot: Dot) => Promise<string[]>;
	dataSources: (dot: Dot) => Promise<string[]>;
	reachableDots: (dot: Dot) => Promise<string[]>;
	/** SuperBot directory text, only for kind === "super". */
	directory?: (dot: Dot, latestUserText: string) => Promise<string>;
	kind: "main" | "link";
}

export function sectionsExtension(deps: SectionDeps): InlineExtension {
	return {
		name: "opendot-sections",
		hidden: true,
		factory: (api) => {
			api.on("before_agent_start", async (event) => {
				const dot = await deps.getDot();
				const s = event.systemPromptOptions.sections;
				s.now = nowSection(new Date());
				if (await deps.shouldRedact()) s.privacy = PRIVACY_SECTION;
				else delete s.privacy;
				const about = MemoryService.render(await deps.memory.list("user"), 4000);
				if (about) s.about_user = `Things the user has told you about themselves (shared by all Dots):\n${about}`;
				const mem = MemoryService.render(await deps.memory.list(dot.id), 6000);
				s.memory = mem
					? `Your long-term memory (ids in parentheses; use forget(id) to remove outdated items):\n${mem}`
					: "Your long-term memory is empty. Use remember to save durable facts and preferences.";
				const caps = await deps.capabilities(dot);
				const peers = await deps.reachableDots(dot);
				const capLines = caps.length
					? caps.map((c) => `- ${c}`).join("\n")
					: "- No connected tools yet. The user can add some in Dot Info → Tools.";
				s.capabilities = `Tools you can use:\n${capLines}${
					peers.length
						? `\nYou can ask other Dots for help with message_dot: ${peers.join(", ")}. Use list_dots to see what they do.`
						: ""
				}`;
				if (dot.alwaysOn.enabled && deps.kind === "main")
					s.always_on = alwaysOnSection(dot, await deps.dataSources(dot));
				else delete s.always_on;
				if (dot.kind === "super" && deps.directory) s.your_dots = await deps.directory(dot, event.prompt ?? "");
			});
		},
	};
}
