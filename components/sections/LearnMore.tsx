/** Inline "Learn more ›" link that sits at the end of a section's lead paragraph. Adds an internal link, not height. */
export function LearnMore({ href, label }: { href: string; label: string }) {
	return (
		<>
			{" "}
			<a
				href={href}
				aria-label={label}
				className="whitespace-nowrap rounded-sm text-accent transition-colors duration-200 hover:text-accent-hover"
			>
				Learn more ›
			</a>
		</>
	);
}
