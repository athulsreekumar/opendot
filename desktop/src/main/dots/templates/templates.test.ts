import { LIMITS } from "@shared/defaults";
import { DotColorSchema, PersonaSchema, ThinkingSchema } from "@shared/schemas";
import type { DotTemplate } from "@shared/types";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SUPER_TEMPLATE, TEMPLATES } from "./index";

const DotAppearanceSchema = z.object({
	emoji: z.string().min(1).max(16),
	color: DotColorSchema,
});

const WatcherConfigSchema = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
);

const SuggestedWatcherSchema = z.object({
	type: z.string(),
	label: z.string().min(1).max(100),
	config: WatcherConfigSchema,
	intervalSec: z.number().optional(),
});

const AlwaysOnSchema = z.object({
	enabled: z.boolean(),
	standingInstructions: z.string().max(2000),
	notify: z.enum(["urgent", "updates", "none"]),
	quietHours: z.any().optional(),
	batchWindowSec: z.number().min(0).max(300),
	budget: z.object({ maxTurnsPerHour: z.number().min(1).max(500), maxCostUsdPerDay: z.number().min(0).max(1000) }),
});

const DotDraftSchema = z.object({
	name: z.string().min(1).max(LIMITS.nameMax),
	tagline: z.string().max(LIMITS.taglineMax),
	appearance: DotAppearanceSchema,
	persona: PersonaSchema,
	templateId: z.string().optional(),
	model: z.any().optional(),
	thinkingLevel: ThinkingSchema.optional(),
	suggestedConnections: z.array(z.string()),
	roles: z.array(z.string().regex(/^[a-z0-9-]{1,32}$/)).optional(),
	piiMode: z.enum(["auto", "always", "off"]).optional(),
	alwaysOn: AlwaysOnSchema.optional(),
	suggestedWatchers: z.array(SuggestedWatcherSchema).optional(),
});

const DotTemplateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(LIMITS.nameMax),
	category: z.string().min(1),
	description: z.string().min(1).max(1000),
	examplePrompt: z.string().min(LIMITS.creationPromptMin).max(LIMITS.creationPromptMax),
	draft: DotDraftSchema,
}) as unknown as z.ZodType<DotTemplate>;

describe("DotTemplates", () => {
	const allTemplates = [...TEMPLATES, SUPER_TEMPLATE];

	it("should have exactly 11 templates (10 standard + 1 super)", () => {
		expect(TEMPLATES).toHaveLength(10);
		expect(SUPER_TEMPLATE).toBeDefined();
		expect(allTemplates).toHaveLength(11);
	});

	it("should have unique template ids", () => {
		const ids = allTemplates.map((t) => t.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	it("should have expected template ids", () => {
		const ids = TEMPLATES.map((t) => t.id);
		expect(ids).toEqual([
			"general",
			"inbox",
			"calendar",
			"research",
			"writer",
			"dev",
			"finance",
			"files",
			"planner",
			"wellbeing",
		]);
		expect(SUPER_TEMPLATE.id).toBe("super");
	});

	describe.each(allTemplates)("Template: $id", (template) => {
		it("should be valid according to schema", () => {
			const result = DotTemplateSchema.safeParse(template);
			expect(result.success).toBe(true);
			if (!result.success) {
				console.error(result.error);
			}
		});

		it("should have name ≤ 24 chars", () => {
			expect(template.draft.name.length).toBeLessThanOrEqual(LIMITS.nameMax);
		});

		it("should have tagline ≤ 60 chars", () => {
			expect(template.draft.tagline.length).toBeLessThanOrEqual(LIMITS.taglineMax);
		});

		it("should have examplePrompt between 10–2000 chars", () => {
			expect(template.examplePrompt.length).toBeGreaterThanOrEqual(LIMITS.creationPromptMin);
			expect(template.examplePrompt.length).toBeLessThanOrEqual(LIMITS.creationPromptMax);
		});

		it("should have valid persona", () => {
			const persona = template.draft.persona;
			expect(persona.role.length).toBeGreaterThanOrEqual(20);
			expect(persona.role.length).toBeLessThanOrEqual(LIMITS.roleMax * 2);
			expect(persona.quirks.length).toBeLessThanOrEqual(LIMITS.quirksMax);
			persona.quirks.forEach((q: string) => {
				expect(q.length).toBeLessThanOrEqual(80);
			});
			expect(persona.dos.length).toBeLessThanOrEqual(LIMITS.dosMax);
			persona.dos.forEach((d: string) => {
				expect(d.length).toBeLessThanOrEqual(160);
			});
			expect(persona.donts.length).toBeLessThanOrEqual(LIMITS.dosMax);
			persona.donts.forEach((d: string) => {
				expect(d.length).toBeLessThanOrEqual(160);
			});
			expect(persona.greeting.length).toBeLessThanOrEqual(200);
		});

		it("should have valid tone", () => {
			expect(["warm", "neutral", "playful", "direct", "formal"]).toContain(template.draft.persona.tone);
		});

		it("should have valid verbosity (0-100)", () => {
			expect(template.draft.persona.verbosity).toBeGreaterThanOrEqual(0);
			expect(template.draft.persona.verbosity).toBeLessThanOrEqual(100);
		});

		it("should have valid formality (0-100)", () => {
			expect(template.draft.persona.formality).toBeGreaterThanOrEqual(0);
			expect(template.draft.persona.formality).toBeLessThanOrEqual(100);
		});

		it("should have valid emojiUsage (0-100)", () => {
			expect(template.draft.persona.emojiUsage).toBeGreaterThanOrEqual(0);
			expect(template.draft.persona.emojiUsage).toBeLessThanOrEqual(100);
		});

		it("should have at least 2 dos and donts", () => {
			expect(template.draft.persona.dos.length).toBeGreaterThanOrEqual(2);
			expect(template.draft.persona.donts.length).toBeGreaterThanOrEqual(2);
		});

		it("should have unique suggested connections", () => {
			const connections = template.draft.suggestedConnections;
			const unique = new Set(connections);
			expect(unique.size).toBe(connections.length);
		});

		if (template.id === "super") {
			it("should be super template with correct properties", () => {
				expect(template.draft.roles).toContain("super");
				expect(template.draft.suggestedConnections).toHaveLength(0);
				expect(template.draft.persona.tone).toBe("direct");
				expect(template.draft.persona.verbosity).toBe(40);
				expect(template.draft.persona.formality).toBe(50);
				expect(template.draft.persona.emojiUsage).toBe(0);
			});
		}

		if (["inbox", "calendar", "files", "wellbeing"].includes(template.id)) {
			it("should have alwaysOn enabled", () => {
				expect(template.draft.alwaysOn?.enabled).toBe(true);
				expect(template.draft.alwaysOn?.standingInstructions).toBeTruthy();
				expect(template.draft.suggestedWatchers).toBeDefined();
				expect(template.draft.suggestedWatchers!.length).toBeGreaterThan(0);
			});
		}

		if (["research", "finance"].includes(template.id)) {
			it("should have alwaysOn disabled", () => {
				expect(template.draft.alwaysOn?.enabled).toBe(false);
			});
		}
	});
});
