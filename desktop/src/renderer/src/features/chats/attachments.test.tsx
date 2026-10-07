// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const open = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/api", () => ({
	api: { attachments: { open } },
	errorText: (e: unknown) => String(e),
}));

import { ComposerTray, ImageWarning, MessageAttachments } from "./Attachments";

afterEach(cleanup);

describe("attachment UI", () => {
	it("warns when the model can't see images and lets the user choose file references", () => {
		const onChange = vi.fn();
		const { rerender } = render(<ImageWarning asFiles={false} onChange={onChange} />);
		expect(screen.getByText("This model can't see images")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Send as file references" }));
		expect(onChange).toHaveBeenCalledWith(true);
		rerender(<ImageWarning asFiles onChange={onChange} />);
		expect(screen.getByText("Images will be sent as file references")).toBeTruthy();
	});

	it("shows removable chips in the composer", () => {
		const onRemove = vi.fn();
		render(
			<ComposerTray
				drafts={[{ id: "att_1", name: "notes.txt", kind: "text", mime: "text/plain", size: 2048 }]}
				onRemove={onRemove}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Remove notes.txt" }));
		expect(onRemove).toHaveBeenCalledWith("att_1");
	});

	it("opens a file chip and reveals it from the small button", () => {
		render(
			<MessageAttachments
				dotId="dot_1"
				attachments={[{ name: "Report.pdf", kind: "file", size: 1000, path: "attachments/1-Report.pdf" }]}
			/>,
		);
		fireEvent.click(screen.getByTitle("Open Report.pdf"));
		expect(open).toHaveBeenCalledWith("dot_1", "attachments/1-Report.pdf", false);
		fireEvent.click(screen.getByRole("button", { name: "Show Report.pdf in folder" }));
		expect(open).toHaveBeenCalledWith("dot_1", "attachments/1-Report.pdf", true);
	});

	it("shows image thumbnails that open a lightbox", () => {
		render(
			<MessageAttachments
				dotId="dot_1"
				attachments={[{ name: "p.png", kind: "image", url: "opendot-media://x/dot/dot_1/1-p.png" }]}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "View p.png" }));
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(screen.getByRole("dialog").querySelector("img")?.getAttribute("src")).toContain("1-p.png");
	});
});
