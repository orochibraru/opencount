import { AppLockDTO } from "#lib/dto/app-lock.js";
import { SessionLockDTO } from "#lib/dto/session-lock.js";
import { SessionDTO } from "#lib/dto/session.js";
import { getSetting } from "#lib/dto/setting.js";

export type UnlockResult = "unlocked" | "wrong" | "signed-out";

interface LockedSession {
	id: string;
	userId: string;
}

/** Locks a signed-in session behind the account's passcode once it sits idle, so a picked-up phone shows nothing. */
class AppLockService {
	readonly maxFailures = 5;
	readonly #touchEveryMs = 15_000;

	/** Whether `session` is locked, locking it once it went idle too long and recording activity otherwise. */
	isLocked(session: LockedSession, now = new Date()): boolean {
		const lock = AppLockDTO.forUser(session.userId);
		if (!lock) {
			return false;
		}
		const state = SessionLockDTO.forSession(session.id);
		if (!state) {
			SessionLockDTO.touch(session.id, now);
			return false;
		}
		const idleMs = now.getTime() - state.lastActiveAt.getTime();
		if (state.locked || idleMs > lock.lockAfterMinutes * 60_000) {
			if (!state.locked) {
				SessionLockDTO.lock(session.id);
			}
			return true;
		}
		if (idleMs > this.#touchEveryMs) {
			SessionLockDTO.touch(session.id, now);
		}
		return false;
	}

	/** Locks `sessionId` now, when the person leaves the app or asks for it. */
	lock(sessionId: string): void {
		SessionLockDTO.lock(sessionId);
	}

	/**
	 * Checks `passcode` against the account's and unlocks `session` when it matches; too many wrong ones sign the session
	 * out for good.
	 */
	async unlock(
		session: LockedSession,
		passcode: string,
	): Promise<UnlockResult> {
		const lock = AppLockDTO.forUser(session.userId);
		if (!lock) {
			SessionLockDTO.unlock(session.id);
			return "unlocked";
		}
		if (await Bun.password.verify(passcode, lock.passcodeHash)) {
			SessionLockDTO.unlock(session.id);
			return "unlocked";
		}
		if (SessionLockDTO.recordFailure(session.id) >= this.maxFailures) {
			SessionDTO.revoke(session.id);
			return "signed-out";
		}
		return "wrong";
	}

	/** Whether `passcode` is `userId`'s current one. */
	matches(userId: string, passcode: string): Promise<boolean> {
		const lock = AppLockDTO.forUser(userId);
		return lock
			? Bun.password.verify(passcode, lock.passcodeHash)
			: Promise.resolve(false);
	}

	/** Sets `userId`'s passcode and delay, keeping the session that set it unlocked and locking their others. */
	async save(
		userId: string,
		sessionId: string,
		passcode: string,
		lockAfterMinutes: number,
	): Promise<void> {
		AppLockDTO.save(userId, {
			passcodeHash: await Bun.password.hash(passcode),
			lockAfterMinutes,
		});
		SessionLockDTO.touch(sessionId, new Date());
		SessionLockDTO.lockOthers(userId, sessionId);
	}

	/** Whether the person may turn the app lock off: not when an admin requires one. */
	canRemove(): boolean {
		return !getSetting("requireAppLock");
	}
}

export const appLock = new AppLockService();
