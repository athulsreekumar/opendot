import { DOT_COLORS } from "@shared/types";
import { useState } from "react";
import {
	Avatar,
	Badge,
	Button,
	Dialog,
	EmptyState,
	IconButton,
	Input,
	Kbd,
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
	ScrollArea,
	SegmentedControl,
	Select,
	Sheet,
	Slider,
	Spinner,
	StatusPill,
	type StatusState,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	TextArea,
	toast,
} from "@/design-system/components";
import { IconChats, IconPlus, IconSend, IconSettings, IconTrash } from "@/design-system/icons";
import { shortcut } from "@/lib/platform";

const STATES: StatusState[] = [
	"connected",
	"connecting",
	"needs-auth",
	"error",
	"disabled",
	"disconnected",
	"running",
	"idle",
	"paused",
	"backoff",
	"over-budget",
	"off",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3 border-b border-border-subtle pb-6">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-fg-3">{title}</h3>
			{children}
		</section>
	);
}

function Row({ children }: { children: React.ReactNode }) {
	return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function Showcase() {
	const [seg, setSeg] = useState("a");
	const [slider, setSlider] = useState(40);
	const [sel, setSel] = useState("one");
	const [on, setOn] = useState(true);
	const [dialog, setDialog] = useState(false);
	const [sheet, setSheet] = useState(false);

	return (
		<div className="flex flex-col gap-6">
			<Section title="Button">
				<Row>
					<Button>Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="danger">Danger</Button>
					<Button variant="link">Link</Button>
				</Row>
				<Row>
					<Button size="sm">Small</Button>
					<Button size="md">Medium</Button>
					<Button size="lg">Large</Button>
					<Button loading>Loading</Button>
					<Button disabled>Disabled</Button>
					<Button leadingIcon={<IconPlus size={16} />}>Leading</Button>
				</Row>
			</Section>
			<Section title="IconButton">
				<Row>
					<IconButton label="Chats" size="sm" icon={<IconChats size={16} />} />
					<IconButton label="Settings" size="md" variant="secondary" icon={<IconSettings size={18} />} />
					<IconButton label="Send" size="lg" variant="accent" icon={<IconSend size={20} />} />
					<IconButton label="Disabled" disabled icon={<IconTrash size={18} />} />
				</Row>
			</Section>
			<Section title="Input · TextArea">
				<Input placeholder="Default input" />
				<Input placeholder="Invalid input" invalid />
				<Input placeholder="Disabled" disabled />
				<TextArea placeholder="Text area" autoGrow maxRows={4} />
			</Section>
			<Section title="Switch · Slider · Select">
				<Switch
					checked={on}
					onCheckedChange={setOn}
					label="Always on"
					description="Keep this Dot working in the background."
				/>
				<Slider
					value={slider}
					onValueChange={setSlider}
					min={0}
					max={100}
					leftLabel="Calm"
					rightLabel="Bold"
					aria-label="Tone"
				/>
				<Select
					value={sel}
					onValueChange={setSel}
					aria-label="Model"
					groups={[
						{
							label: "Cloud",
							items: [
								{ value: "one", label: "Model one", description: "Fast" },
								{ value: "two", label: "Model two" },
							],
						},
						{ label: "Local", items: [{ value: "three", label: "Model three" }] },
					]}
				/>
			</Section>
			<Section title="Badge · Kbd">
				<Row>
					<Badge variant="unread" count={3} />
					<Badge variant="unread" count={120} />
					<Badge variant="muted">Muted</Badge>
					<Badge variant="success">Success</Badge>
					<Badge variant="warning">Warning</Badge>
					<Badge variant="danger">Danger</Badge>
					<Badge variant="info">Info</Badge>
					<Badge variant="outline">Outline</Badge>
					<Kbd>{shortcut("K")}</Kbd>
				</Row>
			</Section>
			<Section title="Avatar">
				<Row>
					{(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
						<Avatar key={s} size={s} name={s} emoji="🦊" color="teal" />
					))}
				</Row>
				<Row>
					<Avatar name="online" emoji="📬" color="green" status="online" />
					<Avatar name="busy" emoji="🗓" color="amber" status="busy" />
					<Avatar name="away" emoji="🌙" color="lime" status="away" />
					<Avatar name="error" emoji="⚠" color="orange" status="error" />
					<Avatar name="ring" emoji="🎧" color="teal" ring />
					<Avatar name="super" color="teal" mark />
				</Row>
				<Row>
					{DOT_COLORS.map((c) => (
						<Avatar key={c} size="sm" name={c} emoji="●" color={c} />
					))}
				</Row>
			</Section>
			<Section title="StatusPill · Spinner">
				<Row>
					{STATES.map((s) => (
						<StatusPill key={s} state={s} />
					))}
				</Row>
				<Row>
					<Spinner size={16} />
					<Spinner size={20} />
					<Spinner size={24} />
				</Row>
			</Section>
			<Section title="SegmentedControl · Tabs">
				<SegmentedControl
					value={seg}
					onValueChange={setSeg}
					options={[
						{ value: "a", label: "Warm" },
						{ value: "b", label: "Neutral" },
						{ value: "c", label: "Direct" },
					]}
				/>
				<Tabs defaultValue="one">
					<TabsList>
						<TabsTrigger value="one">One</TabsTrigger>
						<TabsTrigger value="two">Two</TabsTrigger>
					</TabsList>
					<TabsContent value="one" className="py-2 text-sm text-fg-2">
						First tab
					</TabsContent>
					<TabsContent value="two" className="py-2 text-sm text-fg-2">
						Second tab
					</TabsContent>
				</Tabs>
			</Section>
			<Section title="Menu · Dialog · Sheet · Toast">
				<Row>
					<Menu>
						<MenuTrigger asChild>
							<Button variant="secondary">Open menu</Button>
						</MenuTrigger>
						<MenuContent>
							<MenuItem shortcut={shortcut("N")}>New Dot</MenuItem>
							<MenuItem>Duplicate</MenuItem>
							<MenuSeparator />
							<MenuItem destructive>Delete</MenuItem>
						</MenuContent>
					</Menu>
					<Button variant="secondary" onClick={() => setDialog(true)}>
						Dialog
					</Button>
					<Button variant="secondary" onClick={() => setSheet(true)}>
						Sheet
					</Button>
					<Button
						variant="secondary"
						onClick={() => toast({ title: "Saved", description: "All good.", variant: "success" })}
					>
						Toast
					</Button>
				</Row>
				<Dialog
					open={dialog}
					onOpenChange={setDialog}
					title="Dialog title"
					description="A short description."
					footer={<Button onClick={() => setDialog(false)}>Done</Button>}
				>
					<p className="text-md text-fg-2">Dialog body.</p>
				</Dialog>
				<Sheet open={sheet} onOpenChange={setSheet} title="Sheet">
					<p className="p-4 text-md text-fg-2">Sheet body.</p>
				</Sheet>
			</Section>
			<Section title="ScrollArea · EmptyState">
				<div className="h-24 rounded-lg border border-border-subtle">
					<ScrollArea className="h-24">
						<div className="flex flex-col gap-1 p-2 text-sm text-fg-2">
							{["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"].map((n) => (
								<div key={n}>{n}</div>
							))}
						</div>
					</ScrollArea>
				</div>
				<EmptyState
					icon={<IconChats size={32} />}
					title="Nothing here"
					body="Try creating something."
					action={{ label: "Create", onClick: () => undefined }}
				/>
			</Section>
		</div>
	);
}

export function Gallery() {
	return (
		<div className="h-full overflow-y-auto bg-app">
			<div className="grid grid-cols-1 xl:grid-cols-2">
				{(["light", "dark"] as const).map((theme) => (
					<div key={theme} data-theme={theme} className="bg-app p-8 text-fg">
						<h2 className="mb-6 text-2xl font-semibold">Gallery · {theme}</h2>
						<Showcase />
					</div>
				))}
			</div>
		</div>
	);
}
