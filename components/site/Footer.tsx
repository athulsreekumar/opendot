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
							<svg
								width="20"
								height="20"
								viewBox="0 0 20 20"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								aria-hidden="true"
							>
								<rect width="20" height="20" rx="4" fill="var(--accent)" />
								<circle cx="6" cy="6" r="1.5" fill="white" />
								<circle cx="10" cy="10" r="1.5" fill="white" />
								<circle cx="14" cy="14" r="1.5" fill="white" />
							</svg>
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

				{/* Bottom line */}
				<div className="od-footer-bottom">
					<p className="t-caption text-fg-3">© 2026 OpenDot · Only available for Mac</p>
				</div>
			</div>
		</footer>
	);
}
