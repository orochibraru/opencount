import { beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { hasLinkedProvider } from "#lib/dto/account.js";
import { setSetting } from "#lib/dto/setting.js";
import { UserDTO } from "#lib/dto/user.js";
import { getAuth } from "#lib/server/auth.js";
import { getDb } from "#lib/server/db/lib.js";
import { account, job, user } from "#lib/server/db/schema.js";
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
			magicLink: false,
			emailCode: false,
			sso: [{ id: "authentik", name: "authentik" }],
		});
	});

	test("a user can use password, and SSO once they linked it", () => {
		const ada = createUser("ada");
		const methods = {
			password: false,
			passkey: true,
			magicLink: false,
			emailCode: false,
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

describe("signing in by email", () => {
	beforeEach(() => {
		resetDatabase();
		getDb().delete(account).run();
	});

	function enableEmail() {
		setSetting("smtp", {
			host: "smtp.example.com",
			port: 587,
			security: "starttls",
			username: "",
			encryptedPassword: encryptSecret(""),
			fromAddress: "opencount@example.com",
			fromName: "OpenCount",
		});
		setSetting("magicLinkSignIn", true);
		setSetting("emailCodeSignIn", true);
	}

	function post(path: string, body: unknown): Promise<Response> {
		return getAuth().handler(
			new Request(`http://localhost/api/auth${path}`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost",
				},
				body: JSON.stringify(body),
			}),
		);
	}

	function lastEmail(): { subject: string; text: string } | undefined {
		return getDb()
			.select({ payload: job.payload })
			.from(job)
			.all()
			.map((row) => row.payload as { subject: string; text: string })
			.at(-1);
	}

	test("both methods stay off without SMTP or the admin's say-so", async () => {
		setSetting("magicLinkSignIn", true);
		expect(enabledSignInMethods()).toMatchObject({
			magicLink: false,
			emailCode: false,
		});
		const link = await post("/sign-in/magic-link", {
			email: "ada@example.com",
		});
		expect(link.status).toBe(403);
		const code = await post("/email-otp/send-verification-otp", {
			email: "ada@example.com",
			type: "sign-in",
		});
		expect(code.status).toBe(403);
	});

	test("a code by email signs an existing account in", async () => {
		enableEmail();
		createUser("ada");
		expect(enabledSignInMethods()).toMatchObject({
			magicLink: true,
			emailCode: true,
		});
		expect(usableMethods("ada", enabledSignInMethods())).toContain("email");
		const sent = await post("/email-otp/send-verification-otp", {
			email: "ada@example.com",
			type: "sign-in",
		});
		expect(sent.status).toBe(200);
		const code = /(\d{3}) (\d{3})/.exec(lastEmail()?.text ?? "");
		expect(code).not.toBeNull();
		const wrong = await post("/sign-in/email-otp", {
			email: "ada@example.com",
			otp: "000000",
		});
		expect(wrong.status).toBe(400);
		const signedIn = await post("/sign-in/email-otp", {
			email: "ada@example.com",
			otp: `${code?.[1]}${code?.[2]}`,
		});
		expect(signedIn.status).toBe(200);
		expect(signedIn.headers.getSetCookie().join(";")).toContain(
			"session_token",
		);
	});

	test("a link by email signs an existing account in", async () => {
		enableEmail();
		createUser("ada");
		const sent = await post("/sign-in/magic-link", {
			email: "ada@example.com",
			callbackURL: "/",
		});
		expect(sent.status).toBe(200);
		const link = /http\S+magic-link\/verify\S+/.exec(lastEmail()?.text ?? "");
		expect(link).not.toBeNull();
		const verified = await getAuth().handler(
			new Request(link?.[0] ?? "", { redirect: "manual" }),
		);
		expect(verified.status).toBeGreaterThanOrEqual(300);
		expect(verified.headers.getSetCookie().join(";")).toContain(
			"session_token",
		);
	});

	test("no account is created and two-factor accounts are turned away", async () => {
		enableEmail();
		const ghost = await post("/sign-in/email-otp", {
			email: "ghost@example.com",
			otp: "123456",
		});
		expect(ghost.status).not.toBe(200);
		expect(UserDTO.idForEmail("ghost@example.com")).toBeUndefined();

		createUser("grace", "Grace");
		getDb()
			.update(user)
			.set({ twoFactorEnabled: true })
			.where(eq(user.id, "grace"))
			.run();
		expect(usableMethods("grace", enabledSignInMethods())).not.toContain(
			"email",
		);
		const refused = await post("/sign-in/magic-link", {
			email: "grace@example.com",
		});
		expect(refused.status).toBe(403);
		expect(await refused.text()).toContain("authenticator app");
	});

	test("emailed codes only ever sign in", async () => {
		enableEmail();
		createUser("ada");
		const reset = await post("/email-otp/send-verification-otp", {
			email: "ada@example.com",
			type: "forget-password",
		});
		expect(reset.status).toBe(403);
		const disabled = await post("/email-otp/reset-password", {
			email: "ada@example.com",
			otp: "123456",
			password: "Another-Password-99",
		});
		expect(disabled.status).toBe(404);
	});
});
