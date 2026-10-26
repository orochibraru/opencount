import { CodeChallengeDTO } from "#lib/dto/code-challenge.js";
import { UserDTO } from "#lib/dto/user.js";
import { Logger } from "#lib/server/logger.js";

const logger = new Logger("Setup");

const setupIdentifier = "setup";

export class SetupError extends Error {}

/** Whether this is a fresh instance: no account exists yet. */
export function needsSetup(): boolean {
	return UserDTO.count() === 0;
}

/**
 * Writes a fresh setup code to the server log, proving whoever enters it can read this server's logs.
 *
 * @throws SetupError when a code was printed less than a minute ago.
 */
export function issueSetupCode(): void {
	let code: string;
	try {
		code = CodeChallengeDTO.start(setupIdentifier);
	} catch (error) {
		throw new SetupError(
			error instanceof Error ? error.message : String(error),
		);
	}
	logger.warn(
		`Setup code: ${code.slice(0, 3)} ${code.slice(3)} (valid 15 minutes). Enter it at /auth/setup to create the admin account.`,
	);
}

/** Checks a setup code; it's consumed on success. */
export function verifySetupCode(code: string): boolean {
	return CodeChallengeDTO.find(setupIdentifier)?.verify(code) ?? false;
}

/** Logs how to finish setting up a fresh instance, with a first code; does nothing once an account exists. */
export function announceSetup(): void {
	if (!needsSetup()) {
		return;
	}
	try {
		issueSetupCode();
	} catch (error) {
		logger.info(
			"No accounts yet: open /auth/setup to create the admin account",
			{ reason: (error as Error).message },
		);
	}
}
