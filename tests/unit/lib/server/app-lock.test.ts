import { beforeEach, describe, expect, test } from "bun:test";

import { AppLockDTO } from "#lib/dto/app-lock.js";
import { SessionLockDTO } from "#lib/dto/session-lock.js";
import { SessionDTO } from "#lib/dto/session.js";
import { setSetting } from "#lib/dto/setting.js";
import { access } from "#lib/server/auth/access.js";
import { appLock } from "#lib/server/auth/app-lock.js";
import type { Session } from "#lib/server/auth/auth.js";
import { securityPolicy } from "#lib/server/auth/security-policy.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { session } from "#lib/server/db/schema.js";

import { createUser, resetDatabase } from "../../database.js";

function createSession(
	id: string,
	userId = "ada",
): { id: string; userId: string } {
	databaseConnection
		.get()
		.insert(session)
		.values({
			id,
			userId,
			token: `token-${id}`,
			expiresAt: new Date(Date.now() + 86_400_000),
		})
		.run();
	return { id, userId };
}

describe("app lock", () => {
	beforeEach(() => {
		resetDatabase();
		createUser("ada");
	});

	test("never locks an account without a passcode", () => {
		const current = createSession("one");
		expect(appLock.isLocked(current, new Date(Date.now() + 86_400_000))).toBe(
			false,
		);
	});

	test("locks after the delay and unlocks with the passcode only", async () => {
		const current = createSession("one");
		await appLock.save("ada", current.id, "123456", 5);
		expect(appLock.isLocked(current)).toBe(false);
		const later = new Date(Date.now() + 6 * 60_000);
		expect(appLock.isLocked(current, later)).toBe(true);
		expect(appLock.isLocked(current)).toBe(true);
		expect(await appLock.unlock(current, "000000")).toBe("wrong");
		expect(await appLock.unlock(current, "123456")).toBe("unlocked");
		expect(appLock.isLocked(current)).toBe(false);
	});

	test("a new passcode locks the other devices", async () => {
		const current = createSession("one");
		const other = createSession("two");
		await appLock.save("ada", current.id, "123456", 15);
		expect(appLock.isLocked(current)).toBe(false);
		expect(appLock.isLocked(other)).toBe(true);
	});

	test("too many wrong passcodes sign the session out", async () => {
		const current = createSession("one");
		await appLock.save("ada", current.id, "123456", 15);
		appLock.lock(current.id);
		for (let attempt = 1; attempt < appLock.maxFailures; attempt += 1) {
			expect(await appLock.unlock(current, "000000")).toBe("wrong");
		}
		expect(await appLock.unlock(current, "000000")).toBe("signed-out");
		expect(SessionDTO.forUser("ada")).toEqual([]);
		expect(SessionLockDTO.forSession(current.id)).toBeUndefined();
	});
});

describe("app lock storage", () => {
	beforeEach(() => {
		resetDatabase();
		createUser("ada");
	});

	test("keeps the hash out of toJSON, changes the delay and turns off", async () => {
		const current = createSession("one");
		await appLock.save("ada", current.id, "123456", 5);
		const stored = AppLockDTO.forUser("ada");
		expect(stored?.toJSON()).toEqual({ lockAfterMinutes: 5 });
		expect(stored?.passcodeHash).not.toBe("123456");
		expect(await appLock.matches("ada", "123456")).toBe(true);
		expect(await appLock.matches("ada", "654321")).toBe(false);
		AppLockDTO.saveDelay("ada", 60);
		expect(AppLockDTO.forUser("ada")?.lockAfterMinutes).toBe(60);
		AppLockDTO.remove("ada");
		expect(AppLockDTO.forUser("ada")).toBeUndefined();
		expect(await appLock.matches("ada", "123456")).toBe(false);
		expect(await appLock.unlock(current, "000000")).toBe("unlocked");
	});

	test("records activity once it's older than a few seconds", async () => {
		const current = createSession("one");
		await appLock.save("ada", current.id, "123456", 5);
		const later = new Date(Date.now() + 60_000);
		expect(appLock.isLocked(current, later)).toBe(false);
		expect(SessionLockDTO.forSession(current.id)?.lastActiveAt).toEqual(later);
		expect(SessionLockDTO.forSession(current.id)?.failedAttempts).toBe(0);
	});

	test("an untracked session starts unlocked", async () => {
		const current = createSession("one");
		await appLock.save("ada", current.id, "123456", 5);
		const fresh = createSession("fresh");
		databaseConnection.get().delete(session).run();
		createSession("fresh");
		expect(appLock.isLocked(fresh)).toBe(false);
		expect(SessionLockDTO.forSession(fresh.id)?.locked).toBe(false);
	});

	test("an admin requiring it keeps it on", () => {
		expect(appLock.canRemove()).toBe(true);
		setSetting("requireAppLock", true);
		expect(appLock.canRemove()).toBe(false);
	});
});

describe("sessions", () => {
	beforeEach(() => {
		resetDatabase();
		createUser("ada");
		createUser("grace", "Grace");
	});

	test("lists, signs out one and signs out the others, only for their owner", () => {
		createSession("one");
		createSession("two");
		createSession("three");
		createSession("hers", "grace");
		SessionLockDTO.touch("two", new Date(Date.now() + 1000));
		expect(SessionDTO.forUser("ada").map((entry) => entry.toJSON().id)[0]).toBe(
			"two",
		);
		expect(SessionDTO.revokeForUser("hers", "ada")).toBe(false);
		expect(SessionDTO.revokeForUser("three", "ada")).toBe(true);
		SessionDTO.revokeOthers("ada", "one");
		expect(SessionDTO.forUser("ada").map((entry) => entry.toJSON().id)).toEqual(
			["one"],
		);
		expect(SessionDTO.forUser("grace")).toHaveLength(1);
	});
});

describe("session gate", () => {
	beforeEach(() => {
		resetDatabase();
		createUser("ada");
	});

	function current(id: string, createdAt = new Date()): Session {
		return {
			session: { id, userId: "ada", createdAt },
			user: { id: "ada", twoFactorEnabled: false },
		} as unknown as Session;
	}

	test("lets a plain session through, gates a locked one and one missing a factor", async () => {
		createSession("one");
		expect(
			securityPolicy.sessionGate(current("one"), "/(protected)"),
		).toBeUndefined();
		setSetting("requireAppLock", true);
		expect(securityPolicy.missingFactors({ id: "ada" })).toEqual(["app-lock"]);
		expect(securityPolicy.sessionGate(current("one"), "/(protected)")).toEqual({
			reason: "factors",
			missing: ["app-lock"],
		});
		expect(
			securityPolicy.sessionGate(
				current("one"),
				"/(protected)/account/security",
			),
		).toBeUndefined();
		await appLock.save("ada", "one", "123456", 5);
		appLock.lock("one");
		expect(
			securityPolicy.sessionGate(current("one"), "/(protected)"),
		).toMatchObject({
			reason: "locked",
			sessionId: "one",
		});
	});

	test("a recent sign-in lasts 15 minutes, and admin grants need one", () => {
		const now = Date.now();
		expect(
			securityPolicy.signedInRecently(
				{ createdAt: new Date(now - 60_000) },
				now,
			),
		).toBe(true);
		expect(
			securityPolicy.signedInRecently(
				{ createdAt: new Date(now - 16 * 60_000) },
				now,
			),
		).toBe(false);
		const admin = { id: "ada", role: "admin" } as unknown as Session["user"];
		expect(
			access.recentAdminFrom({
				user: admin,
				session: { createdAt: new Date() },
			} as unknown as App.Locals),
		).toBe(admin);
		expect(
			access.recentAdminFrom({
				user: admin,
				session: { createdAt: new Date(now - 3_600_000) },
			} as unknown as App.Locals),
		).toMatchObject({ status: 403 });
		expect(
			access.recentAdminFrom({
				user: null,
				session: null,
			} as unknown as App.Locals),
		).toMatchObject({ status: 403 });
	});
});
