import { describe, expect, it } from "vitest";
import { formatAttachmentBlock } from "../../shared/attachments";
import { type EntryLike, entriesToViews } from "./views";

describe("entriesToViews with attachments", () => {
	it("turns attachment blocks into chips and keeps only the typed text", () => {
		const text = `look\n\n${formatAttachmentBlock({ name: "a.png", kind: "image", path: "attachments/1-a.png" }, "note")}`;
		const entries: EntryLike[] = [
			{
				type: "message",
				id: "e1",
				timestamp: "2026-01-01T00:00:00.000Z",
				message: {
					role: "user",
					content: [
						{ type: "text", text },
						{ type: "image", data: "AAAA", mimeType: "image/png" },
					],
				},
			},
		];
		const [v] = entriesToViews("dot_1", entries, (s) => s, new Map());
		expect(v?.text).toBe("look");
		expect(v?.attachments?.[0]).toMatchObject({
			name: "a.png",
			kind: "image",
			url: "opendot-media://x/dot/dot_1/1-a.png",
		});
	});
});
