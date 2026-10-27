import { dev } from "$app/env";
import { getRequestEvent } from "$app/server";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import type { RequestEvent } from "@sveltejs/kit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
	APIError,
	createAuthMiddleware,
	getSessionFromCtx,
} from "better-auth/api";
import {
	emailOTP,
	genericOAuth,
	jwt,
	magicLink,
	twoFactor,
} from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";

import { getSetting, setSetting, type SsoProvider } from "#lib/dto/setting.js";
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
import {
	recentSignInMessage,
	signedInRecently,
} from "#lib/server/security-policy.js";

const logger = new Logger("Auth");

/**
 * The public origin links in emails and passkeys use: `ORIGIN`, else the one recorded at setup or by an admin. Ignored in
 * dev, where Vite serves the real one.
 */
export function publicOrigin(): string | undefined {
	if (dev) {
		return undefined;
	}
	return getConfig().origin ?? getSetting("publicOrigin") ?? undefined;
}

/** Records `origin` as the public origin when nothing pins one yet, from a request only an admin or setup makes. */
export function rememberPublicOrigin(origin: string): void {
	if (!dev && !getConfig().origin && !getSetting("publicOrigin")) {
		setSetting("publicOrigin", origin);
	}
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
	body: { type?: unknown } | undefined,
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
	return undefined;
}

/** Whether the account behind `email` uses an authenticator app, which a link or code by email would skip. */
function usesAuthenticator(email: string): boolean {
	const userId = UserDTO.idForEmail(email.trim().toLowerCase());
	return userId !== undefined && UserDTO.twoFactorEnabled(userId);
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

const browserPaths = [
	"/callback/",
	"/magic-link/verify",
	"/reset-password/",
	"/passkey/",
	"/get-session",
	"/sign-out",
	"/error",
	"/ok",
	"/oauth2/authorize",
	"/oauth2/token",
	"/oauth2/register",
	"/oauth2/consent",
	"/oauth2/revoke",
	"/oauth2/userinfo",
	"/jwks",
	"/.well-known/",
];

const passkeyRegistrationPaths = new Set([
	"/passkey/generate-register-options",
	"/passkey/verify-registration",
]);

async function sessionRefusal(
	context: Parameters<Parameters<typeof createAuthMiddleware>[0]>[0],
): Promise<APIError | undefined> {
	if (
		context.request &&
		!browserPaths.some((path) => context.path.startsWith(path))
	) {
		return new APIError("NOT_FOUND", { message: "Not found." });
	}
	const event: RequestEvent | undefined = getRequestEvent();
	if (event?.locals.gate?.reason === "locked" && context.path !== "/sign-out") {
		return new APIError("UNAUTHORIZED", { message: "Unlock OpenCount first." });
	}
	if (!passkeyRegistrationPaths.has(context.path)) {
		return undefined;
	}
	const current = await getSessionFromCtx(context);
	if (current && !signedInRecently(current.session)) {
		return new APIError("FORBIDDEN", { message: recentSignInMessage });
	}
	return undefined;
}

/**
 * Refuses the sign-in methods an admin turned off, whether the request came over HTTP or from a server action, any
 * better-auth endpoint the browser has no reason to call directly (form actions call them with their own limits), and
 * every call from a locked session but signing out.
 */
const enforceSignInMethods = createAuthMiddleware(async (context) => {
	const error = (await sessionRefusal(context)) ?? refusal(context);
	if (error) {
		throw error;
	}
});

const secondFactorSkippingPaths = [
	"/callback/",
	"/magic-link/verify",
	"/sign-in/email-otp",
];

/** Stops a single sign-on, email link or email code sign-in from skipping an authenticator app the account set up. */
function refuseSkippedSecondFactor(
	userId: string,
	context: { path?: string } | null | undefined,
): Promise<void> {
	if (
		secondFactorSkippingPaths.some((path) => context?.path?.startsWith(path)) &&
		UserDTO.twoFactorEnabled(userId)
	) {
		return Promise.reject(
			new APIError("FORBIDDEN", {
				message:
					"This account uses an authenticator app: sign in with your password, then your code.",
			}),
		);
	}
	return Promise.resolve();
}

/** How long sessions last, how they're rate limited and cookied, and the check that runs before one is created. */
function sessionOptions(sessionDays: number, origin: string | undefined) {
	const day = 24 * 60 * 60;
	return {
		session: {
			expiresIn: sessionDays * day,
			updateAge: sessionDays > 1 ? day : day / 24,
			freshAge: 15 * 60,
		},
		rateLimit: { enabled: !dev, window: 60, max: 100 },
		advanced: {
			useSecureCookies: !dev && !origin?.startsWith("http://"),
		},
		databaseHooks: {
			session: {
				create: {
					before: (
						session: { userId: string },
						context: { path?: string } | null,
					) => refuseSkippedSecondFactor(session.userId, context),
				},
			},
		},
	};
}

function createAuth(
	providers: SsoProvider[],
	signUpsEnabled: boolean,
	sessionDays: number,
	origin: string | undefined,
) {
	return betterAuth({
		appName: "OpenCount",
		baseURL: origin,
		trustedOrigins: origin ? [origin] : [],
		secret: getConfig().auth.secret,
		database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
		...sessionOptions(sessionDays, origin),
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
					if (!usesAuthenticator(email)) {
						queueEmail(magicLinkEmail(email, url));
					}
					return Promise.resolve();
				},
			}),
			emailOTP({
				disableSignUp: true,
				otpLength: 6,
				expiresIn: 600,
				allowedAttempts: 5,
				sendVerificationOTP: ({ email, otp, type }) => {
					if (type === "sign-in" && !usesAuthenticator(email)) {
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
 * when an admin changes the single sign-on providers, the sign-up policy or the session lifetime, or the origin it is
 * reached at changes: the public origin, else the request's, which the MCP server's OAuth endpoints are built from.
 */
export function getAuth(): Auth {
	const providers = getSetting("ssoProviders");
	const signUpsEnabled = getSetting("signUpsEnabled");
	const sessionDays = getSetting("sessionDays");
	const origin = publicOrigin() ?? requestOrigin();
	const key = JSON.stringify([providers, signUpsEnabled, sessionDays, origin]);
	if (instance?.key !== key) {
		instance = {
			auth: createAuth(providers, signUpsEnabled, sessionDays, origin),
			key,
		};
	}
	return instance.auth;
}
