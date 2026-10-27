import { dev } from "$app/env";
import { getRequestEvent } from "$app/server";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
	emailOTP,
	genericOAuth,
	jwt,
	magicLink,
	twoFactor,
} from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";

import { getSetting, type SsoProvider } from "#lib/dto/setting.js";
import { UserDTO } from "#lib/dto/user.js";
import { passwordMaxLength, passwordMinLength } from "#lib/password-policy.js";
import { getConfig } from "#lib/server/config.js";
import { getDb } from "#lib/server/db/lib.js";
import * as schema from "#lib/server/db/schema.js";
import {
	magicLinkEmail,
	queueEmail,
	resetPasswordEmail,
	signInCodeEmail,
} from "#lib/server/emails.js";
import { Logger } from "#lib/server/logger.js";
import { isEmailConfigured } from "#lib/server/mailer.js";
import { decryptSecret } from "#lib/server/secrets.js";

const logger = new Logger("Auth");

/** The configured public origin, ignored in dev where Vite serves the real one. */
export function publicOrigin(): string | undefined {
	return dev ? undefined : getConfig().origin;
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The address AI apps reach the MCP server at on `origin`, or none when it isn't HTTPS or localhost, which OAuth requires. */
export function mcpResource(origin: string | undefined): string | undefined {
	if (!origin) {
		return undefined;
	}
	const url = new URL("/mcp", origin);
	return url.protocol === "https:" || loopbackHosts.has(url.hostname)
		? url.href
		: undefined;
}

function requestOrigin(): string | undefined {
	try {
		return getRequestEvent().url.origin;
	} catch {
		return undefined;
	}
}

function aiAppPlugins(resource: string | undefined) {
	if (!resource) {
		return [];
	}
	return [
		jwt(),
		mcp({
			resource,
			loginPage: "/auth/oauth",
			consentPage: "/oauth/consent",
			scopes: ["openid", "offline_access"],
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			clientRegistrationDefaultApplicationType: "infer",
		}),
		cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
	];
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

const passwordResetPaths = new Set([
	"/request-password-reset",
	"/reset-password",
]);

/** Why a request uses a sign-in method an admin turned off, if it does. */
const magicLinkPaths = new Set(["/sign-in/magic-link", "/magic-link/verify"]);
const emailCodePaths = new Set([
	"/email-otp/send-verification-otp",
	"/sign-in/email-otp",
]);

function emailRefusal(
	setting: "magicLinkSignIn" | "emailCodeSignIn",
	body: { email?: unknown; type?: unknown } | undefined,
): APIError | undefined {
	if (!getSetting(setting) || !isEmailConfigured()) {
		return new APIError("FORBIDDEN", {
			message: "That sign-in method is turned off on this server.",
		});
	}
	if (body?.type !== undefined && body.type !== "sign-in") {
		return new APIError("FORBIDDEN", {
			message: "Codes by email are only for signing in.",
		});
	}
	const userId =
		typeof body?.email === "string"
			? UserDTO.idForEmail(body.email.trim().toLowerCase())
			: undefined;
	if (userId && UserDTO.twoFactorEnabled(userId)) {
		return new APIError("FORBIDDEN", {
			message:
				"This account uses an authenticator app: sign in with your password, then your code.",
		});
	}
	return undefined;
}

function refusal(context: {
	path: string;
	body?: { provider?: unknown; email?: unknown; type?: unknown };
}): APIError | undefined {
	if (magicLinkPaths.has(context.path)) {
		return emailRefusal("magicLinkSignIn", context.body);
	}
	if (emailCodePaths.has(context.path)) {
		return emailRefusal("emailCodeSignIn", context.body);
	}
	if (
		passwordResetPaths.has(context.path) &&
		(!getSetting("passwordSignIn") || !isEmailConfigured())
	) {
		return new APIError("FORBIDDEN", {
			message: "Password resets are turned off on this server.",
		});
	}
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

function createAuth(
	providers: SsoProvider[],
	signUpsEnabled: boolean,
	origin: string | undefined,
) {
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
		account: { accountLinking: { enabled: true } },
		emailAndPassword: {
			enabled: true,
			autoSignIn: true,
			minPasswordLength: passwordMinLength,
			maxPasswordLength: passwordMaxLength,
			resetPasswordTokenExpiresIn: 3600,
			revokeSessionsOnPasswordReset: true,
			sendResetPassword: ({ user, url }) => {
				queueEmail(resetPasswordEmail(user.email, url));
				return Promise.resolve();
			},
		},
		disabledPaths: [
			"/token",
			"/sign-up/email",
			"/email-otp/verify-email",
			"/email-otp/request-password-reset",
			"/email-otp/reset-password",
			"/email-otp/request-email-change",
			"/email-otp/change-email",
			"/forget-password/email-otp",
		],
		hooks: { before: enforceSignInMethods },
		telemetry: { enabled: false },
		logger: { log: forwardAuthLog },
		plugins: [
			twoFactor({ issuer: "OpenCount" }),
			passkey({ rpName: "OpenCount" }),
			magicLink({
				disableSignUp: true,
				expiresIn: 600,
				sendMagicLink: ({ email, url }) => {
					queueEmail(magicLinkEmail(email, url));
					return Promise.resolve();
				},
			}),
			emailOTP({
				disableSignUp: true,
				otpLength: 6,
				expiresIn: 600,
				allowedAttempts: 5,
				sendVerificationOTP: ({ email, otp, type }) => {
					if (type === "sign-in") {
						queueEmail(signInCodeEmail(email, otp));
					}
					return Promise.resolve();
				},
			}),
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
			...aiAppPlugins(mcpResource(origin)),
			sveltekitCookies(getRequestEvent),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];

let instance: { auth: Auth; key: string } | undefined;

/**
 * The better-auth instance, created on first use so a build never opens the database or needs the secret, and rebuilt
 * when an admin changes the single sign-on providers or the sign-up policy they depend on, or the origin it is reached
 * at, which the MCP server's OAuth endpoints are built from, changes.
 */
export function getAuth(): Auth {
	const providers = getSetting("ssoProviders");
	const signUpsEnabled = getSetting("signUpsEnabled");
	const origin = publicOrigin() ?? requestOrigin();
	const key = JSON.stringify([providers, signUpsEnabled, origin]);
	if (instance?.key !== key) {
		instance = {
			auth: createAuth(providers, signUpsEnabled, origin),
			key,
		};
	}
	return instance.auth;
}
