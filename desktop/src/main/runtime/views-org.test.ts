import { describe, expect, it } from "vitest";
import { entriesToViews } from "./views";

describe("org update messages", () => {
	it("maps opendot.org-update to ChatMessageView.orgUpdate and hides the planner turn prompt", () => {
		const details = {
			projectId: "prj_abc123456789",
			title: "Add SSO",
			kind: "plan-ready",
			text: "The plan for Add SSO is ready.",
		};
		const views = entriesToViews(
			"dot_super0000001",
			[
				{
					type: "custom_message",
					id: "e1",
					timestamp: "2026-01-01T00:00:00.000Z",
					customType: "opendot.org-turn",
					content: "plan it",
					display: false,
					details: {},
				},
				{
					type: "custom_message",
					id: "e2",
					timestamp: "2026-01-01T00:00:01.000Z",
					customType: "opendot.org-update",
					content: details.text,
					display: true,
					details,
				},
				{
					type: "custom_message",
					id: "e3",
					timestamp: "2026-01-01T00:00:02.000Z",
					customType: "opendot.org-update",
					content: "broken",
					display: true,
					details: {},
				},
			],
			(s) => s,
			new Map(),
		);
		expect(views).toHaveLength(1);
		expect(views[0]).toMatchObject({
			id: "e2",
			role: "assistant",
			text: details.text,
			orgUpdate: details,
			streaming: false,
		});
	});
});
