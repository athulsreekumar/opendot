// PKCE (RFC 7636) helpers. Spec 05 §4.
import { createHash, randomBytes } from "node:crypto";

export function createVerifier(): string {
	return randomBytes(64).toString("base64url");
}

export function challengeS256(verifier: string): string {
	return createHash("sha256").update(verifier).digest("base64url");
}

export function randomState(): string {
	return randomBytes(24).toString("base64url");
}
