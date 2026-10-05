import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const gen12 = customAlphabet(alphabet, 12);

export type IdPrefix = "dot" | "msg" | "lnk" | "con" | "apr" | "aud" | "wat" | "evt" | "exc" | "mem";

export function newId<P extends IdPrefix>(prefix: P): `${P}_${string}` {
	return `${prefix}_${gen12()}`;
}

export const ID_PATTERNS = {
	dot: /^dot_[A-Za-z0-9_-]{6,40}$/,
	con: /^con_[A-Za-z0-9_-]{6,40}$/,
	lnk: /^lnk_[A-Za-z0-9_-]{6,40}$/,
	apr: /^apr_[A-Za-z0-9_-]{6,40}$/,
	wat: /^wat_[A-Za-z0-9_-]{6,40}$/,
} as const;
