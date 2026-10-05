import { LogoMark } from "@/components/ui/LogoMark";
import { footer } from "@/lib/copy";
import "./Footer.css";

export function Footer() {
	return (
		<footer className="chapter-light od-footer section-pad">
			<div className="container-site flex flex-col gap-8">
				{/* Top section - logo, branding, tagline, and links */}
				<div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
					{/* Left: Logo + OpenDot + tagline */}
					<div className="flex items-center gap-3">
						<div className="od-logo-mark">
							<LogoMark size={20} />
						</div>
						<div className="flex flex-col">
							<p className="t-caption font-semibold text-fg">OpenDot</p>
							<p className="t-caption text-fg-3">{footer.tagline}</p>
						</div>
					</div>

					{/* Right: Footer links */}
					<div className="flex gap-6">
						{footer.links.map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="t-caption text-fg hover:text-accent transition-colors duration-200"
								{...(link.label === "GitHub" && { target: "_blank", rel: "noopener noreferrer" })}
							>
								{link.label}
							</a>
						))}
					</div>
				</div>

				<nav aria-label="Footer" className="grid grid-cols-1 gap-8 border-t border-line pt-8 sm:grid-cols-2">
					{footer.columns.map((col) => (
						<div key={col.title}>
							<p className="t-caption font-semibold text-fg">{col.title}</p>
							<ul className="mt-3 flex flex-col gap-2">
								{col.links.map((l) => (
									<li key={l.href}>
										<a href={l.href} className="t-caption text-fg-2 transition-colors duration-200 hover:text-accent">
											{l.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				{/* Bottom line */}
				<div className="od-footer-bottom">
					<p className="t-caption text-fg-3">© 2026 OpenDot · Only available for Mac</p>
				</div>
			</div>
		</footer>
	);
}
