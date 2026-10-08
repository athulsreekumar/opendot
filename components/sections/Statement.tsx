import { Fragment } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { statement } from "@/lib/copy";

/** Words that end in the brand glow colour (matched without punctuation, lower-case). */
const GLOW = new Set(["job", "personality", "never", "sleep"]);
const bare = (w: string) => w.replace(/[^\p{L}]/gu, "").toLowerCase();

/** Chapter 2: one large sentence with its key words tinted. Normal flow, no pin. */
export function Statement() {
	const words = statement.split(/\s+/);

	return (
		<section id="statement" className="chapter-dark relative bg-bg text-fg">
			<div className="flex min-h-[70svh] items-center py-24 lg:py-32">
				<div className="container-site">
					<Reveal>
						<h2 className="t-display-m mx-auto max-w-[22ch] text-center text-[clamp(2.25rem,1.2rem+3.6vw,4.5rem)]!">
							{words.map((w, i) => (
								<Fragment key={i}>
									<span className={GLOW.has(bare(w)) ? "text-brand-glow" : undefined}>{w}</span>
									{i < words.length - 1 ? " " : null}
								</Fragment>
							))}
						</h2>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
