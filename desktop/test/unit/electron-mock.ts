import type { SafeStorageLike } from "../../src/main/security/secret-store";

export const fakeSafeStorage: SafeStorageLike = {
	isEncryptionAvailable: () => true,
	encryptString: (s) => Buffer.from(`enc:${Buffer.from(s).toString("base64")}`),
	decryptString: (b) => Buffer.from(b.toString().slice(4), "base64").toString(),
};
