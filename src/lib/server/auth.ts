import { dev } from "$app/env";
import { getRequestEvent } from "$app/server";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { genericOAuth, twoFactor } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";

import { getSetting, type SsoProvider } from "#lib/dto/setting.js";
import { passwordMaxLength, passwordMinLength } from "#lib/password-policy.js";
import { getConfig } from "#lib/server/config.js";
import { getDb } from "#lib/server/db/lib.js";
import * as schema from "#lib/server/db/schema.js";
import { Logger } from "#lib/server/logger.js";
import { decryptSecret } from "#lib/server/secrets.js";

const logger = new Logger("Auth");

/** The configured public origin, ignored in dev where Vite serves the real one. */
export function publicOrigin(): string | undefined {
	return dev ? undefined : getConfig().origin;
}

/** Routes a better-auth log line through the app logger, dropping the "Base URL is not set" warning the request-derived origin causes. */
export function forwardAuthLog(
	level: "debug" | "info" | "warn" | "error",
	message: string,
	...args: unknown[]
): void {
	if (message.includes("Base URL is not set")) {
		return;
	}
	logger[level](message, ...args);
}

const passkeySignInPaths = new Set([
	"/passkey/generate-authenticate-options",
	"/passkey/verify-authentication",
]);

/** Why a request uses a sign-in method an admin turned off, if it does. */
function refusal(context: {
	path: string;
	body?: { provider?: unknown };
}): APIError | undefined {
	if (context.path === "/sign-in/email" && !getSetting("passwordSignIn")) {
		return new APIError("FORBIDDEN", {
			message: "Password sign-in is turned off on this server.",
		});
	}
	if (passkeySignInPaths.has(context.path) && !getSetting("passkeySignIn")) {
		return new APIError("FORBIDDEN", {
			message: "Passkey sign-in is turned off on this server.",
		});
	}
	if (
		context.path === "/sign-in/social" ||
		context.path.startsWith("/callback/")
	) {
		const providerId = context.path.startsWith("/callback/")
			? context.path.slice("/callback/".length)
			: String(context.body?.provider ?? "");
		const provider = getSetting("ssoProviders").find(
			(entry) => entry.id === providerId,
		);
		if (!provider?.enabled) {
			return new APIError("FORBIDDEN", {
				message: "That sign-in method is turned off on this server.",
			});
		}
	}
	return undefined;
}

/** Refuses the sign-in methods an admin turned off, whether the request came over HTTP or from a server action. */
const enforceSignInMethods = createAuthMiddleware((context) => {
	const error = refusal(context);
	return error ? Promise.reject(error) : Promise.resolve();
});

function createAuth(providers: SsoProvider[], signUpsEnabled: boolean) {
	const origin = publicOrigin();
	const ssoIds = providers.map((provider) => provider.id);
	return betterAuth({
		appName: "OpenCount",
		baseURL: origin,
		trustedOrigins: origin ? [origin] : [],
		secret: getConfig().auth.secret,
		database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
		user: {
			additionalFields: {
				role: {
					type: ["admin", "member"],
					required: false,
					defaultValue: "member",
					input: false,
				},
			},
		},
		account: { accountLinking: { enabled: true, trustedProviders: ssoIds } },
		emailAndPassword: {
			enabled: true,
			autoSignIn: true,
			minPasswordLength: passwordMinLength,
			maxPasswordLength: passwordMaxLength,
		},
		disabledPaths: ["/sign-up/email"],
		hooks: { before: enforceSignInMethods },
		telemetry: { enabled: false },
		logger: { log: forwardAuthLog },
		plugins: [
			twoFactor({ issuer: "OpenCount" }),
			passkey({ rpName: "OpenCount" }),
			genericOAuth({
				config: providers.map((provider) => ({
					providerId: provider.id,
					name: provider.name,
					discoveryUrl: provider.discoveryUrl,
					clientId: provider.clientId,
					clientSecret: decryptSecret(provider.encryptedClientSecret),
					scopes: ["openid", "email", "profile"],
					pkce: true,
					disableImplicitSignUp: !signUpsEnabled,
				})),
			}),
			sveltekitCookies(getRequestEvent),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];

let instance: { auth: Auth; key: string } | undefined;

/**
 * The better-auth instance, created on first use so a build never opens the database or needs the secret, and rebuilt
 * when an admin changes the single sign-on providers or the sign-up policy they depend on.
 */
export function getAuth(): Auth {
	const providers = getSetting("ssoProviders");
	const signUpsEnabled = getSetting("signUpsEnabled");
	const key = JSON.stringify([providers, signUpsEnabled]);
	if (instance?.key !== key) {
		instance = { auth: createAuth(providers, signUpsEnabled), key };
	}
	return instance.auth;
}
