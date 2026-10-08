// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar, Badge, Button, IconButton, Input, Spinner, Switch, TextArea, Tooltip, TooltipProvider } from "./index";

afterEach(() => {
	cleanup();
});

describe("Button", () => {
	it("renders with text", () => {
		const { getByRole } = render(<Button>Click me</Button>);
		expect(getByRole("button", { name: /click me/i })).toBeTruthy();
	});

	it("sets aria-busy when loading", () => {
		const { getByRole } = render(<Button loading>Loading</Button>);
		const button = getByRole("button", { name: /loading/i });
		expect(button.getAttribute("aria-busy")).toBe("true");
	});

	it("disables button when disabled prop is set", () => {
		const { getByRole } = render(<Button disabled>Disabled</Button>);
		expect((getByRole("button") as HTMLButtonElement).disabled).toBe(true);
	});
});

describe("IconButton", () => {
	it("renders with aria-label from label prop", () => {
		const icon = <span>→</span>;
		const { getByRole } = render(
			<TooltipProvider delayDuration={0}>
				<IconButton label="Send" icon={icon} />
			</TooltipProvider>,
		);
		expect(getByRole("button").getAttribute("aria-label")).toBe("Send");
	});
});

describe("Input", () => {
	it("renders as an input element", () => {
		const { getByPlaceholderText } = render(<Input placeholder="Enter text" />);
		expect(getByPlaceholderText(/enter text/i)).toBeTruthy();
	});

	it("sets aria-invalid when invalid prop is true", () => {
		const { getByRole } = render(<Input invalid />);
		expect(getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
	});
});

describe("TextArea", () => {
	it("renders as a textarea element", () => {
		const { getByPlaceholderText } = render(<TextArea placeholder="Enter message" />);
		expect(getByPlaceholderText(/enter message/i)).toBeTruthy();
	});

	it("shows character count with showCount", () => {
		const { container } = render(<TextArea maxLength={100} showCount value="hello" onChange={() => {}} />);
		expect(container.textContent).toContain("5 / 100");
	});
});

describe("Switch", () => {
	it("renders with role switch", () => {
		const { getByRole } = render(<Switch label="Enable" />);
		expect(getByRole("switch")).toBeTruthy();
	});

	it("renders with label", () => {
		const { getByText } = render(<Switch label="Enable notifications" />);
		expect(getByText(/enable notifications/i)).toBeTruthy();
	});
});

describe("Badge", () => {
	it("renders with unread variant showing 99+ for 120", () => {
		const { getByText } = render(<Badge variant="unread" count={120} />);
		expect(getByText("99+")).toBeTruthy();
	});

	it("renders with exact count when under 100", () => {
		const { getByText } = render(<Badge variant="unread" count={5} />);
		expect(getByText("5")).toBeTruthy();
	});

	it("renders with text content as children", () => {
		const { getByText } = render(<Badge variant="muted">New</Badge>);
		expect(getByText("New")).toBeTruthy();
	});
});

describe("Avatar", () => {
	it("renders with aria-label from name prop", () => {
		const { getByLabelText } = render(<Avatar icon="mail" color="teal" size="md" name="Alice" />);
		expect(getByLabelText("Alice")).toBeTruthy();
	});

	it("renders the icon as an svg and no text", () => {
		const { getByLabelText } = render(<Avatar icon="mail" color="teal" size="md" name="Inbox" />);
		const el = getByLabelText("Inbox");
		expect(el.querySelector("svg")).toBeTruthy();
		expect(el.textContent).toBe("");
	});

	it("falls back to the neutral icon for an unknown key", () => {
		const { getByLabelText } = render(<Avatar icon="not-an-icon" color="teal" size="md" name="Odd" />);
		expect(getByLabelText("Odd").querySelector("svg")).toBeTruthy();
	});

	it("scales icon size and stroke with the avatar size", () => {
		const { getByLabelText } = render(
			<>
				<Avatar icon="mail" color="teal" size="xs" name="Small" />
				<Avatar icon="mail" color="teal" size="xl" name="Big" />
			</>,
		);
		const small = getByLabelText("Small").querySelector("svg") as SVGElement;
		const big = getByLabelText("Big").querySelector("svg") as SVGElement;
		expect(Number(big.getAttribute("width"))).toBeGreaterThan(Number(small.getAttribute("width")));
		expect(small.getAttribute("stroke-width")).toBe("2");
	});

	it("renders brand mark when mark prop is true", () => {
		const { container } = render(<Avatar icon="mail" color="teal" size="md" name="TestMark" mark />);
		expect(container.querySelector("svg")).toBeTruthy();
	});
});

describe("Tooltip", () => {
	it("renders with content", () => {
		const { getByRole } = render(
			<TooltipProvider delayDuration={0}>
				<Tooltip content="Help text">
					<button type="button">Hover me</button>
				</Tooltip>
			</TooltipProvider>,
		);
		expect(getByRole("button", { name: /hover me/i })).toBeTruthy();
	});
});

describe("Spinner", () => {
	it("renders with role status", () => {
		const { container } = render(<Spinner />);
		expect(container.querySelector('[role="status"]')).toBeTruthy();
	});

	it("renders with aria-label Loading", () => {
		const { container } = render(<Spinner />);
		expect(container.querySelector('[aria-label="Loading"]')).toBeTruthy();
	});
});
