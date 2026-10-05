import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const MAX_BYTES = 350 * 1024;

/** Write `<base>.avif` (q~60) and `<base>.webp` (q~80), lowering quality until each is under 350 KB. */
export async function writeOptimised(pngPath: string, base: string): Promise<{ avif: number; webp: number }> {
	mkdirSync(dirname(base), { recursive: true });
	const sizes = { avif: 0, webp: 0 };
	let q = 60;
	for (;;) {
		await sharp(pngPath).avif({ quality: q, effort: 6, chromaSubsampling: "4:4:4" }).toFile(`${base}.avif`);
		sizes.avif = statSync(`${base}.avif`).size;
		if (sizes.avif <= MAX_BYTES || q <= 30) break;
		q -= 5;
	}
	q = 80;
	for (;;) {
		await sharp(pngPath).webp({ quality: q, effort: 6 }).toFile(`${base}.webp`);
		sizes.webp = statSync(`${base}.webp`).size;
		if (sizes.webp <= MAX_BYTES || q <= 40) break;
		q -= 5;
	}
	return sizes;
}
