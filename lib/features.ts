// Switches for parts of the page that are built but not shown yet. Flip to true to bring them back.
export const FEATURES = {
	/** "Watch the film" button + film dialog. Turn on once public/film/opendot-film-1080.mp4 exists. */
	film: false,
	/** Autoplaying hero loop over the hero screenshot. Turn on once public/film/hero-loop-1080.mp4 exists. */
	heroLoop: false,
	/** The "Open source. Built in the open." section. */
	openSource: true,
	/** Early-access email signup (form, dialog, /api/early-access). Off: the site sends people to GitHub instead. */
	earlyAccess: false,
} as const;
