// Dots CRUD, creation from drafts, SuperBot bootstrap, profiles (spec 08, 13).
import { mkdirSync } from "node:fs";
import { defaultAlwaysOn, emptyProfile, LIMITS } from "../../shared/defaults";
import { OpenDotError } from "../../shared/errors";
import { newId } from "../../shared/ids";
import type {
	Connection,
	ConnectionGrant,
	CreateDotInput,
	Dot,
	DotDraft,
	DotId,
	DotPatch,
	DotTemplate,
	SuggestedWatcher,
} from "../../shared/types";
import type { ConnectionService } from "../connections/connection-service";
import { log } from "../log";
import type { Paths } from "../paths";
import type { Store } from "../store/store";
import { SUPER_TEMPLATE, TEMPLATES } from "./templates";

export interface DotServiceHooks {
	onCreated?: (dot: Dot, watchers: SuggestedWatcher[]) => Promise<void>;
	onUpdated?: (prev: Dot, next: Dot) => Promise<void>;
	onRemoved?: (dot: Dot) => Promise<void>;
	broadcast?: (dots: Dot[]) => void;
}

const FEATURE_LABEL: Record<string, string> = {
	gmail: "Gmail: search, read and draft email (sending needs approval)",
	calendar: "Calendar: list, create and update events",
	drive: "Google Drive: search, read and create documents",
	mail: "Outlook: search, read and draft email (sending needs approval)",
	onedrive: "OneDrive: search, read and create files",
	teams: "Teams: read chats and send messages (needs approval)",
	files: "Files in your workspace folder: read, search, write and edit",
	shell: "Shell commands (each needs approval)",
	reminders: "Apple Reminders: list, add and complete",
	contacts: "Apple Contacts: search",
	notes: "Apple Notes: search, read and create",
	screen: "Screenshots (need approval)",
	clipboard: "Clipboard: read (needs approval) and write",
	notifications: "Mac notifications",
	open: "Open links and apps (needs approval)",
};

const LEGACY_SUPER_NAME = "Super";
const LEGACY_SUPER_GREETING =
	"Hi! I'm Super. Ask me anything \u2014 I'll check with your Dots and bring the answer back.";

export class DotService {
	hooks: DotServiceHooks = {};
	constructor(
		private readonly store: Store,
		private readonly paths: Paths,
		private readonly connections: ConnectionService,
	) {}

	templates(): DotTemplate[] {
		return TEMPLATES;
	}

	list(): Promise<Dot[]> {
		return this.store.dots.list();
	}

	async get(id: DotId): Promise<Dot> {
		const d = await this.store.dots.get(id);
		if (!d) throw new OpenDotError("NOT_FOUND", "This Dot no longer exists.");
		return d;
	}

	private async broadcast(): Promise<void> {
		this.hooks.broadcast?.(await this.list());
	}

	/** Build a Dot from a draft (does not save). */
	async fromDraft(draft: DotDraft, extra: Partial<Dot> = {}): Promise<Dot> {
		const id = newId("dot");
		const now = new Date().toISOString();
		const dot: Dot = {
			id,
			kind: "standard",
			name: draft.name.trim().slice(0, LIMITS.nameMax) || "New Dot",
			tagline: draft.tagline.slice(0, LIMITS.taglineMax),
			appearance: draft.appearance,
			persona: draft.persona,
			templateId: draft.templateId,
			suggestedConnections: [],
			model: draft.model,
			thinkingLevel: draft.thinkingLevel ?? "low",
			grants: [],
			roles: (draft.roles ?? [])
				.map((r) => r.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
				.filter(Boolean)
				.slice(0, 8),
			piiMode: draft.piiMode ?? "auto",
			alwaysOn: {
				...defaultAlwaysOn(),
				...(draft.alwaysOn ?? {}),
				budget: { ...defaultAlwaysOn().budget, ...(draft.alwaysOn?.budget ?? {}) },
			},
			profile: emptyProfile(),
			hiddenFromSuper: false,
			workspaceDir: this.paths.dotWorkspace(id),
			pinned: false,
			muted: false,
			archived: false,
			createdAt: now,
			updatedAt: now,
			lastActivityAt: now,
			lastMessagePreview: previewOf(draft.persona.greeting),
			unreadCount: 0,
			...extra,
		};
		return dot;
	}

	async create(input: CreateDotInput): Promise<Dot> {
		const existing = await this.list();
		if (existing.filter((d) => !d.archived).length >= LIMITS.maxDots) {
			throw new OpenDotError("LIMIT", `You can have up to ${LIMITS.maxDots} Dots.`);
		}
		const draft = { ...input.draft };
		draft.name = uniqueName(draft.name, existing);
		const dot = await this.fromDraft(draft, {
			creationPrompt: input.creationPrompt?.slice(0, LIMITS.creationPromptMax),
		});
		const choiceIds = input.connectors?.map((c) => c.id) ?? draft.suggestedConnections ?? [];
		const pending: string[] = [];
		for (const choice of choiceIds) {
			const g = await this.connections.grantFor(choice);
			if (g) mergeGrant(dot.grants, g.connectionId, g.features);
			else pending.push(choice);
		}
		dot.suggestedConnections = pending;
		mkdirSync(dot.workspaceDir, { recursive: true });
		await this.store.dots.put(dot);
		await this.refreshProfile(dot.id);
		const saved = await this.get(dot.id);
		await this.hooks.onCreated?.(saved, input.watchers ?? draft.suggestedWatchers ?? []);
		await this.broadcast();
		return saved;
	}

	async update(id: DotId, patch: DotPatch): Promise<Dot> {
		const prev = await this.get(id);
		const { clearModel, ...rest } = patch;
		if (prev.kind === "super" && (rest.archived || rest.roles?.includes("super") === false)) {
			// Super keeps its role and can't be archived.
			rest.archived = false;
		}
		if (rest.name && rest.name !== prev.name)
			rest.name = uniqueName(
				rest.name,
				(await this.list()).filter((d) => d.id !== id),
			);
		const _next = await this.store.dots.update(id, (d) => {
			const n: Dot = { ...d, ...rest, updatedAt: new Date().toISOString() };
			if (clearModel) delete n.model;
			if (n.kind === "super" && !n.roles.includes("super")) n.roles = ["super", ...n.roles].slice(0, 8);
			return n;
		});
		if (patch.grants || patch.alwaysOn || patch.persona) await this.refreshProfile(id);
		const final = await this.get(id);
		await this.hooks.onUpdated?.(prev, final);
		await this.broadcast();
		return final;
	}

	/** Internal update without hooks (activity, unread, profile). */
	async patchQuiet(id: DotId, fn: (d: Dot) => Dot): Promise<Dot> {
		return this.store.dots.update(id, fn);
	}

	async remove(id: DotId): Promise<void> {
		const d = await this.get(id);
		if (d.kind === "super") throw new OpenDotError("SUPER_IMMUTABLE", "SuperDot can't be deleted.");
		await this.hooks.onRemoved?.(d);
		await this.store.dots.remove(id);
		this.store.forgetDot(id);
		// Remove dot-specific link rules and watchers.
		await this.store.links.update((rules) =>
			rules.filter(
				(r) => !((r.from.kind === "dot" && r.from.dotId === id) || (r.to.kind === "dot" && r.to.dotId === id)),
			),
		);
		await this.store.watchers.update((ws) => ws.filter((w) => w.dotId !== id));
		await this.broadcast();
	}

	async duplicate(id: DotId): Promise<Dot> {
		const src = await this.get(id);
		if (src.kind === "super") throw new OpenDotError("SUPER_IMMUTABLE", "SuperDot can't be duplicated.");
		const existing = await this.list();
		const copy = await this.fromDraft(
			{
				name: uniqueName(`${src.name} copy`.slice(0, LIMITS.nameMax), existing),
				tagline: src.tagline,
				appearance: src.appearance,
				persona: src.persona,
				suggestedConnections: [],
			},
			{
				grants: structuredClone(src.grants),
				roles: [...src.roles],
				model: src.model,
				thinkingLevel: src.thinkingLevel,
				piiMode: src.piiMode,
				alwaysOn: { ...src.alwaysOn, enabled: false },
				templateId: src.templateId,
				creationPrompt: src.creationPrompt,
			},
		);
		mkdirSync(copy.workspaceDir, { recursive: true });
		await this.store.dots.put(copy);
		await this.refreshProfile(copy.id);
		await this.broadcast();
		return this.get(copy.id);
	}

	async markRead(id: DotId): Promise<Dot> {
		return this.store.dots.update(id, (d) => ({ ...d, unreadCount: 0 }));
	}

	/** Create the SuperBot and its default rule on first run (spec 13 §1, §7). Idempotent. */
	async ensureSuperBot(): Promise<Dot> {
		const dots = await this.list();
		const existing = dots.find((d) => d.kind === "super");
		if (existing) return this.migrateSuperName(existing);
		const dot = await this.fromDraft(SUPER_TEMPLATE.draft, {
			kind: "super",
			roles: ["super"],
			pinned: true,
			templateId: "super",
			lastActivityAt: new Date(Date.now() + 1000).toISOString(),
		});
		mkdirSync(dot.workspaceDir, { recursive: true });
		await this.store.dots.put(dot);
		const rules = await this.store.links.read();
		if (!rules.some((r) => r.from.kind === "super")) {
			await this.store.links.write([
				...rules,
				{
					id: newId("lnk"),
					from: { kind: "super" },
					to: { kind: "any" },
					effect: "allow",
					enabled: true,
					approval: "auto",
					maxPerHour: 60,
					sharePii: true,
					purpose: "Answer the user's questions via SuperDot",
					createdAt: new Date().toISOString(),
				},
			]);
		}
		log.info("Created SuperBot");
		return dot;
	}

	/** Rename the lead assistant "Super" to "SuperDot", never touching user customisations. */
	private async migrateSuperName(existing: Dot): Promise<Dot> {
		if (existing.name !== LEGACY_SUPER_NAME) return existing;
		const tpl = SUPER_TEMPLATE.draft.persona;
		const legacyRole = tpl.role.replace("You are SuperDot,", `You are ${LEGACY_SUPER_NAME},`);
		const updated = await this.store.dots.update(existing.id, (d) => {
			const n: Dot = { ...d, name: SUPER_TEMPLATE.draft.name, updatedAt: new Date().toISOString() };
			const persona = { ...d.persona };
			if (persona.role === legacyRole) persona.role = tpl.role;
			if (persona.greeting === LEGACY_SUPER_GREETING) {
				persona.greeting = tpl.greeting;
				if (d.lastMessagePreview === previewOf(LEGACY_SUPER_GREETING)) n.lastMessagePreview = previewOf(tpl.greeting);
			}
			n.persona = persona;
			return n;
		});
		log.info("Renamed Super to SuperDot");
		await this.broadcast();
		return updated;
	}

	/** Deterministic capabilities + data sources (spec 13 §2). */
	async refreshProfile(id: DotId): Promise<void> {
		const dot = await this.get(id);
		const conns = await this.connections.list();
		const caps: string[] = [];
		for (const g of dot.grants) {
			const c = conns.find((x) => x.id === g.connectionId);
			if (!c) continue;
			caps.push(...capabilityLines(c, g));
		}
		const watchers = (await this.store.watchers.read()).filter((w) => w.dotId === id && w.enabled);
		const dataSources = watchers.map(
			(w) =>
				`${w.label} (${w.intervalSec > 0 && !["folder", "local-webhook", "mcp-resource"].includes(w.type) ? `every ${w.intervalSec} s` : "instant"})`,
		);
		await this.store.dots.update(id, (d) => ({
			...d,
			profile: { ...d.profile, capabilities: caps, dataSources, updatedAt: d.profile.updatedAt },
		}));
	}

	/** Grant newly installed connections to Dots that asked for them at creation (spec 08 §5). */
	async applyPendingGrants(): Promise<void> {
		for (const d of await this.list()) {
			if (!d.suggestedConnections.length) continue;
			const still: string[] = [];
			const grants = structuredClone(d.grants);
			let changed = false;
			for (const choice of d.suggestedConnections) {
				const g = await this.connections.grantFor(choice);
				if (g) {
					mergeGrant(grants, g.connectionId, g.features);
					changed = true;
				} else still.push(choice);
			}
			if (changed)
				await this.update(d.id, { grants }).then(() =>
					this.store.dots.update(d.id, (x) => ({ ...x, suggestedConnections: still })),
				);
		}
	}
}

export function capabilityLines(c: Connection, g: ConnectionGrant): string[] {
	if (c.type === "mcp-stdio" || c.type === "mcp-http")
		return [`${c.label}: ${c.description || "MCP tools"}`.slice(0, 160)];
	const feats = g.features?.length ? g.features : c.features;
	return feats.filter((f) => !f.startsWith("folder:")).map((f) => FEATURE_LABEL[f] ?? `${c.label}: ${f}`);
}

function mergeGrant(grants: ConnectionGrant[], connectionId: Connection["id"], features?: string[]): void {
	const g = grants.find((x) => x.connectionId === connectionId);
	if (!g) {
		grants.push({ connectionId, toolRules: {}, ...(features ? { features } : {}) });
		return;
	}
	if (features && g.features) g.features = [...new Set([...g.features, ...features])];
	else if (!features) delete g.features;
}

function uniqueName(name: string, dots: Dot[]): string {
	const base = name.trim().slice(0, LIMITS.nameMax) || "New Dot";
	const taken = new Set(dots.filter((d) => !d.archived).map((d) => d.name.toLowerCase()));
	if (!taken.has(base.toLowerCase())) return base;
	for (let i = 2; ; i++) {
		const n = `${base.slice(0, LIMITS.nameMax - 3)} ${i}`;
		if (!taken.has(n.toLowerCase())) return n;
	}
}

function previewOf(s: string): string {
	const t = s.replace(/\s+/g, " ").trim();
	return t.length > 120 ? `${t.slice(0, 119)}…` : t;
}
