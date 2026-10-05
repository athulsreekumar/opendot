// Generates app/icon.png (512), app/apple-icon.png (180) and app/favicon.ico from the OpenDot logo mark.
// Run: node scripts/generate-icons.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const dots = `<circle cx="322" cy="560" r="78" fill="#fff"/><circle cx="512" cy="470" r="78" fill="#fff"/><circle cx="702" cy="560" r="78" fill="#fff"/>`;
const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16b39b"/><stop offset="1" stop-color="#0b7f70"/></linearGradient></defs>`;
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="64 64 896 896">${defs}<rect x="64" y="64" width="896" height="896" rx="200" fill="url(#g)"/>${dots}</svg>`;
// Apple touch icons must be opaque; iOS applies its own corner mask.
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="64 64 896 896">${defs}<rect x="64" y="64" width="896" height="896" fill="url(#g)"/>${dots}</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();

writeFileSync("app/icon.png", await png(rounded, 512));
writeFileSync("app/apple-icon.png", await png(square, 180));

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(rounded, s)));
const head = Buffer.alloc(6);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map((img, i) => {
	const e = Buffer.alloc(16);
	e[0] = sizes[i];
	e[1] = sizes[i];
	e.writeUInt16LE(1, 4);
	e.writeUInt16LE(32, 6);
	e.writeUInt32LE(img.length, 8);
	e.writeUInt32LE(offset, 12);
	offset += img.length;
	return e;
});
writeFileSync("app/favicon.ico", Buffer.concat([head, ...entries, ...images]));
