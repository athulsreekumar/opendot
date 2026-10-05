import type { Dot } from "@shared/types";
import { useEffect, useState } from "react";
import { navigate } from "@/app/router";
import { Avatar, Button } from "@/design-system/components";
import { api } from "@/lib/api";
import { useDots } from "@/stores/dots";
import { Field, SectionCard } from "./ui";

function DotChips({ dots, empty }: { dots: Dot[]; empty: string }) {
	if (dots.length === 0) return <p className="text-sm text-fg-3">{empty}</p>;
	return (
		<div className="flex flex-wrap gap-1.5">
			{dots.map((d) => (
				<span
					key={d.id}
					className="inline-flex h-7 items-center gap-1.5 rounded-full bg-sunken pl-1 pr-2.5 text-sm text-fg"
				>
					<Avatar
						size="xs"
						name={d.name}
						emoji={d.appearance.emoji}
						color={d.appearance.color}
						mark={d.kind === "super"}
					/>
					{d.name}
				</span>
			))}
		</div>
	);
}

export function LinksSection({ dot }: { dot: Dot }) {
	const all = useDots((s) => s.dots);
	const [out, setOut] = useState<Dot[]>([]);
	const [inn, setInn] = useState<Dot[]>([]);
	const rolesKey = dot.roles.join(",");

	// biome-ignore lint/correctness/useExhaustiveDependencies: roles change link results; recompute when they do
	useEffect(() => {
		let alive = true;
		const others = all.filter((d) => d.id !== dot.id && !d.archived);
		void (async () => {
			try {
				const res = await Promise.all(
					others.map(async (o) => ({
						o,
						to: (await api.links.simulate(dot.id, o.id)).allowed,
						from: (await api.links.simulate(o.id, dot.id)).allowed,
					})),
				);
				if (!alive) return;
				setOut(res.filter((r) => r.to).map((r) => r.o));
				setInn(res.filter((r) => r.from).map((r) => r.o));
			} catch {
				// links unavailable
			}
		})();
		return () => {
			alive = false;
		};
	}, [dot.id, all, rolesKey]);

	return (
		<SectionCard
			title="Dot Links"
			testId="section-links"
			right={
				<Button size="sm" variant="secondary" onClick={() => navigate("#/links")}>
					Edit in Dot Links
				</Button>
			}
		>
			<Field label="Roles">
				<p className="text-sm text-fg-2">
					{dot.roles.length ? dot.roles.join(", ") : "No roles yet. Add some under Identity."}
				</p>
			</Field>
			<Field label="Can message">
				<DotChips dots={out} empty="No other Dots yet." />
			</Field>
			<Field label="Can be messaged by">
				<DotChips dots={inn} empty="No other Dots yet." />
			</Field>
		</SectionCard>
	);
}
