import { beforeEach, describe, expect, test } from "bun:test";

import { hasLinkedProvider } from "#lib/dto/account.js";
import { setSetting } from "#lib/dto/setting.js";
import { getAuth } from "#lib/server/auth.js";
import { getDb } from "#lib/server/db/lib.js";
import { account } from "#lib/server/db/schema.js";
import { encryptSecret } from "#lib/server/secrets.js";
import {
	enabledSignInMethods,
	providerSlug,
	usableMethods,
} from "#lib/server/sign-in-methods.js";

import { createUser, resetDatabase } from "../../database.js";

function provider(id: string, enabled: boolean) {
	return {
		id,
		name: id,
		discoveryUrl: `https://${id}.example.com/.well-known/openid-configuration`,
		clientId: "opencount",
		encryptedClientSecret: encryptSecret("secret"),
		enabled,
	};
}

function linkAccount(userId: string, providerId: string): void {
	getDb()
		.insert(account)
		.values({
			id: `${userId}-${providerId}`,
			accountId: userId,
			providerId,
			userId,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.run();
}

describe("sign-in methods", () => {
	beforeEach(() => {
		resetDatabase();
		getDb().delete(account).run();
	});

	test("only enabled providers are offered", () => {
		setSetting("ssoProviders", [
			provider("authentik", true),
			provider("old", false),
		]);
		expect(enabledSignInMethods()).toEqual({
			password: true,
			passkey: true,
			sso: [{ id: "authentik", name: "authentik" }],
		});
	});

	test("a user can use password, and SSO once they linked it", () => {
		const ada = createUser("ada");
		const methods = {
			password: false,
			passkey: true,
			sso: [{ id: "authentik", name: "Authentik" }],
		};
		expect(usableMethods(ada.id, methods)).toEqual([]);
		linkAccount(ada.id, "authentik");
		expect(hasLinkedProvider(ada.id, [])).toBe(false);
		expect(usableMethods(ada.id, { ...methods, password: true })).toEqual([
			"password",
			"sso",
		]);
	});

	test("provider slugs are URL-safe", () => {
		expect(providerSlug("Keycloak (Prod)!")).toBe("keycloak-prod");
		expect(providerSlug("Éclair")).toBe("eclair");
		expect(providerSlug("***")).toBe("sso");
	});
});

describe("getAuth", () => {
	beforeEach(resetDatabase);

	test("rebuilds only when providers or sign-ups change", () => {
		const first = getAuth();
		expect(getAuth()).toBe(first);
		setSetting("ssoProviders", [provider("authentik", true)]);
		const withProvider = getAuth();
		expect(withProvider).not.toBe(first);
		setSetting("signUpsEnabled", true);
		expect(getAuth()).not.toBe(withProvider);
	});

	test("refuses sign-in methods an admin turned off", async () => {
		setSetting("passwordSignIn", false);
		setSetting("passkeySignIn", false);
		setSetting("ssoProviders", [provider("off", false)]);
		const auth = getAuth();
		const call = (path: string, body?: unknown) =>
			auth.handler(
				new Request(`http://localhost/api/auth${path}`, {
					method: body === undefined ? "GET" : "POST",
					headers: {
						"content-type": "application/json",
						origin: "http://localhost",
					},
					body: body === undefined ? undefined : JSON.stringify(body),
				}),
			);
		const password = await call("/sign-in/email", {
			email: "ada@example.com",
			password: "whatever-it-is",
		});
		expect(password.status).toBe(403);
		expect(await password.text()).toContain("Password sign-in is turned off");
		const passkey = await call("/passkey/generate-authenticate-options");
		expect(passkey.status).toBe(403);
		const sso = await call("/sign-in/social", { provider: "off" });
		expect(sso.status).toBe(403);
		const callback = await call("/callback/missing");
		expect(callback.status).toBe(403);
	});
});
