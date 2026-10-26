import { eq } from "drizzle-orm";

import { getDb } from "#lib/server/db/lib.js";
import { bankCredential } from "#lib/server/db/schema.js";

export interface BankCredentials {
	applicationId: string;
	encryptedPrivateKey: string;
}

/** The Enable Banking application `userId` set up, its private key still encrypted. */
export function bankCredentialsFor(
	userId: string,
): BankCredentials | undefined {
	return getDb()
		.select({
			applicationId: bankCredential.applicationId,
			encryptedPrivateKey: bankCredential.encryptedPrivateKey,
		})
		.from(bankCredential)
		.where(eq(bankCredential.userId, userId))
		.get();
}

/** Stores `userId`'s Enable Banking application, replacing the previous one. */
export function saveBankCredentials(
	userId: string,
	credentials: BankCredentials,
): void {
	getDb()
		.insert(bankCredential)
		.values({ ...credentials, userId })
		.onConflictDoUpdate({
			target: bankCredential.userId,
			set: { ...credentials, updatedAt: new Date() },
		})
		.run();
}

/** Forgets `userId`'s Enable Banking application. */
export function removeBankCredentials(userId: string): void {
	getDb().delete(bankCredential).where(eq(bankCredential.userId, userId)).run();
}
