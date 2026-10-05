import type { CatalogEntry } from "@shared/types";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CATALOG } from "./index";

const CatalogInputSchema = z.object({
	key: z.string().min(1),
	label: z.string().min(1),
	secret: z.boolean(),
	placeholder: z.string().optional(),
	help: z.string().optional(),
	target: z.enum(["env", "header", "arg"]),
});

const CatalogEntrySchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	description: z.string().min(1),
	category: z.enum(["productivity", "dev", "data", "files", "communication", "knowledge", "system", "other"]),
	icon: z.string().min(1),
	type: z.enum(["mcp-stdio", "mcp-http", "google", "microsoft", "mac"]),
	stdio: z
		.object({
			command: z.string().min(1),
			args: z.array(z.string()),
			env: z.record(z.string(), z.string()).optional(),
			cwd: z.string().optional(),
		})
		.optional(),
	http: z
		.object({
			url: z.string().url(),
			headers: z.record(z.string(), z.string()).optional(),
			oauth: z.any().optional(),
		})
		.optional(),
	inputs: z.array(CatalogInputSchema),
	defaultExposure: z.enum(["direct", "deferred", "codemode", "hidden"]),
	docsUrl: z.string().optional(),
	requiresNode: z.boolean().optional(),
	requiresUv: z.boolean().optional(),
	verified: z.boolean(),
}) as unknown as z.ZodType<CatalogEntry>;

describe("CatalogEntries", () => {
	it("should have exactly 18 entries", () => {
		expect(CATALOG).toHaveLength(18);
	});

	it("should have unique ids", () => {
		const ids = CATALOG.map((e) => e.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	it("should have expected catalog ids", () => {
		const ids = CATALOG.map((e) => e.id);
		expect(ids).toEqual([
			"filesystem",
			"memory",
			"sequential-thinking",
			"everything",
			"fetch",
			"git",
			"time",
			"playwright",
			"context7",
			"github",
			"notion",
			"linear",
			"sentry",
			"figma",
			"supabase",
			"vercel",
			"stripe",
			"huggingface",
		]);
	});

	describe.each(CATALOG)("CatalogEntry: $id", (entry) => {
		it("should be valid according to schema", () => {
			const result = CatalogEntrySchema.safeParse(entry);
			expect(result.success).toBe(true);
			if (!result.success) {
				console.error(result.error);
			}
		});

		it("should have either stdio or http (but not both)", () => {
			const hasStdio = !!entry.stdio;
			const hasHttp = !!entry.http;
			expect(hasStdio || hasHttp).toBe(true);
			expect(!(hasStdio && hasHttp)).toBe(true);
		});

		if (entry.http) {
			const httpEntry = entry.http;
			it("should have https URL for http entries", () => {
				expect(httpEntry.url.startsWith("https://")).toBe(true);
			});

			if (httpEntry.headers) {
				it("should have valid secret references in headers", () => {
					Object.values(httpEntry.headers as Record<string, string>).forEach((header) => {
						if (header.includes("${secret:")) {
							expect(header).toMatch(/\$\{secret:[A-Z_]+\}/);
						}
					});
				});
			}
		}

		if (entry.stdio) {
			const stdioEntry = entry.stdio;
			it("should have valid command", () => {
				expect(stdioEntry.command).toBeTruthy();
			});

			if (stdioEntry.env) {
				it("should have valid secret references in env", () => {
					Object.values(stdioEntry.env as Record<string, string>).forEach((value) => {
						if (value.includes("${secret:")) {
							expect(value).toMatch(/\$\{secret:[A-Z_]+\}/);
						}
					});
				});
			}
		}

		it("should reference all inputs in args/headers", () => {
			// Check stdio args
			if (entry.stdio?.args) {
				const argsStr = entry.stdio.args.join(" ");
				// biome-ignore lint/suspicious/noExplicitAny: reason: dynamic test iteration
				entry.inputs.forEach((input: any) => {
					if (input.target === "arg") {
						expect(argsStr).toContain(`{${input.key}}`);
					}
				});
			}

			// Check stdio env
			if (entry.stdio?.env) {
				// biome-ignore lint/suspicious/noExplicitAny: reason: dynamic test iteration
				entry.inputs.forEach((input: any) => {
					if (input.target === "env") {
						const envStr = JSON.stringify(entry.stdio!.env);
						expect(envStr).toContain(`${input.key}`);
					}
				});
			}

			// Check http headers
			if (entry.http?.headers) {
				// biome-ignore lint/suspicious/noExplicitAny: reason: dynamic test iteration
				entry.inputs.forEach((input: any) => {
					if (input.target === "header") {
						const headersStr = JSON.stringify(entry.http!.headers);
						expect(headersStr).toContain(`${input.key}`);
					}
				});
			}
		});

		it("should have requiresNode only for npx entries", () => {
			if (entry.requiresNode) {
				expect(entry.stdio?.command).toBe("npx");
			}
		});

		it("should have requiresUv only for uvx entries", () => {
			if (entry.requiresUv) {
				expect(entry.stdio?.command).toBe("uvx");
			}
		});

		it("should have correct verified status", () => {
			const verifiedIds = [
				"filesystem",
				"memory",
				"sequential-thinking",
				"everything",
				"fetch",
				"git",
				"time",
				"playwright",
				"context7",
				"github",
				"notion",
				"linear",
				"sentry",
				"huggingface",
			];
			if (verifiedIds.includes(entry.id)) {
				expect(entry.verified).toBe(true);
			}

			const unverifiedIds = ["figma", "supabase", "vercel", "stripe"];
			if (unverifiedIds.includes(entry.id)) {
				expect(entry.verified).toBe(false);
			}
		});

		it("should have valid inputs", () => {
			// biome-ignore lint/suspicious/noExplicitAny: reason: dynamic test iteration
			entry.inputs.forEach((input: any) => {
				expect(input.key).toBeTruthy();
				expect(input.label).toBeTruthy();
				expect(["env", "header", "arg"]).toContain(input.target);

				if (input.secret) {
					expect(input.placeholder).toBeTruthy();
					expect(input.key).toMatch(/^[A-Z_]+$/);
				}
			});
		});
	});

	it("should have all entries with valid default exposure", () => {
		// biome-ignore lint/suspicious/noExplicitAny: reason: dynamic test iteration
		CATALOG.forEach((entry: any) => {
			expect(["direct", "deferred", "codemode", "hidden"]).toContain(entry.defaultExposure);
		});
	});
});
