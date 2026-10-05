export class OpenDotError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = "OpenDotError";
	}
}

export function isOpenDotErrorShape(e: unknown): e is { code: string; message: string } {
	return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

export function errorMessage(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (isOpenDotErrorShape(e)) return e.message;
	return String(e);
}
