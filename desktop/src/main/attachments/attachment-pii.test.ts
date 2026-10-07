// Inlined file text must be masked like typed text (the PII extension rewrites every text block in the context).
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatAttachmentBlock } from "../../shared/attachments";
import type { DotId, PiiSettings } from "../../shared/types";
import { PiiService } from "../pii/pii-service";
import { piiExtension } from "../runtime/extensions/pii";

const settings: PiiSettings = { enabledTypes: ["EMAIL", "PHONE"], customTerms: [], detectNames: false };

describe("PII masking of attachments", () => {
	it("masks emails inside an inlined text file before the provider sees them", async () => {
		const dir = await mkdtemp(join(tmpdir(), "att-pii-"));
		try {
			const key = randomBytes(32);
			const pii = new PiiService({
				getSettings: async () => settings,
				vaultFile: (id) => join(dir, `${id}.vault`),
				getVaultKey: async () => key,
				isLocalDot: async () => false,
				getPiiMode: async () => "auto",
				defaultCountry: "US",
			});
			const handlers: Record<string, (e: unknown) => unknown> = {};
			const ext = piiExtension(pii, "dot_x" as DotId);
			(ext as unknown as { factory: (api: unknown) => void }).factory({
				on: (n: string, fn: (e: unknown) => unknown) => (handlers[n] = fn),
			});
			const text = `see this\n\n${formatAttachmentBlock({ name: "contacts.csv", kind: "text" }, "name,email\nAnn,ann.lee@example.com")}`;
			const image = { type: "image", data: "AAAA", mimeType: "image/png" };
			const res = (await handlers.context!({
				messages: [{ role: "user", content: [{ type: "text", text }, image] }],
			})) as { messages: Array<{ content: Array<{ type: string; text?: string }> }> };
			const out = JSON.stringify(res.messages);
			expect(out).not.toContain("ann.lee@example.com");
			expect(out).toContain("⟦EMAIL_1⟧");
			// Images pass through untouched.
			expect(res.messages[0]?.content[1]).toEqual(image);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
