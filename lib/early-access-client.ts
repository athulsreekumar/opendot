// Open the early-access dialog from anywhere (nav, hero, sections). The dialog listens for this event.
export type SignupSource = "hero" | "nav" | "final" | "section";
export const OPEN_EARLY_ACCESS = "opendot:early-access";

export function openEarlyAccess(source: SignupSource = "section"): void {
	window.dispatchEvent(new CustomEvent(OPEN_EARLY_ACCESS, { detail: { source } }));
}
