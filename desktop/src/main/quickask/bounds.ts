// Where the quick-ask window sits and how tall it may grow.
export const QUICK_ASK_WIDTH = 640;
export const QUICK_ASK_MIN_HEIGHT = 64;
export const QUICK_ASK_MAX_HEIGHT = 620;

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function clampHeight(h: number): number {
	if (!Number.isFinite(h)) return QUICK_ASK_MIN_HEIGHT;
	return Math.min(QUICK_ASK_MAX_HEIGHT, Math.max(QUICK_ASK_MIN_HEIGHT, Math.ceil(h)));
}

/** Centered horizontally, top edge about a fifth down the work area (the upper third), never off screen. */
export function quickAskBounds(workArea: Rect, height: number, width = QUICK_ASK_WIDTH): Rect {
	const w = Math.min(width, workArea.width);
	const h = Math.min(clampHeight(height), workArea.height);
	const x = Math.round(workArea.x + (workArea.width - w) / 2);
	const wantY = Math.round(workArea.y + workArea.height * 0.2);
	const maxY = workArea.y + Math.max(0, workArea.height - h);
	return { x, y: Math.min(wantY, maxY), width: w, height: h };
}

/** Slide a window up if growing it would push the bottom edge off the display. */
export function keepOnScreen(b: Rect, workArea: Rect): Rect {
	const h = Math.min(b.height, workArea.height);
	const maxY = workArea.y + workArea.height - h;
	return { ...b, height: h, y: Math.max(workArea.y, Math.min(b.y, maxY)) };
}
