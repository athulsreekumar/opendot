import { Plus } from "lucide-react";
import { faq } from "@/lib/copy";
import "./faq.css";

/** FAQ: native <details> accordion, fully server-rendered so crawlers and no-JS readers get every answer. */
export function Faq() {
	return (
		<section id="faq" aria-labelledby="faq-title" className="chapter-light section-pad bg-bg text-fg">
			<div className="container-text">
				<h2 id="faq-title" className="t-display-l text-center">
					{faq.h2}
				</h2>
				<div className="od-faq mt-12 border-t border-line md:mt-16">
					{faq.items.map((item) => (
						<details key={item.q} className="od-faq-item border-b border-line">
							<summary className="od-faq-summary t-title flex cursor-pointer items-center justify-between gap-6 py-6 text-left">
								<span>{item.q}</span>
								<Plus aria-hidden="true" strokeWidth={1.75} className="od-faq-icon size-6 shrink-0 text-fg-3" />
							</summary>
							<div className="od-faq-body">
								<p className="t-body pb-7 text-fg-2">{item.a}</p>
							</div>
						</details>
					))}
				</div>
			</div>
		</section>
	);
}
