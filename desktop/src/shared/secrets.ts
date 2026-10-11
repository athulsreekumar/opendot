import type { Connection } from "./types";

const SECRET_REF = /\$\{secret:([A-Za-z0-9_]+)\}/g;

/** The secret keys a connection's headers and env refer to, e.g. `GITHUB_TOKEN` in `Bearer ${secret:GITHUB_TOKEN}`. */
export function secretRefs(c: Pick<Connection, "http" | "stdio">): string[] {
	const values = [...Object.values(c.http?.headers ?? {}), ...Object.values(c.stdio?.env ?? {})];
	return [...new Set(values.flatMap((v) => [...v.matchAll(SECRET_REF)].map((m) => m[1]!)))];
}
