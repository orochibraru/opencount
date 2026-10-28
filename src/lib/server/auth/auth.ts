import { dev } from "$app/env";
import { resolve } from "$app/paths";
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
import { securityPolicy } from "#lib/server/auth/security-policy.js";
import { signInMethods } from "#lib/server/auth/sign-in-methods.js";
import { configuration } from "#lib/server/core/config.js";
import { Logger } from "#lib/server/core/logger.js";
import { secrets } from "#lib/server/core/secrets.js";
import { databaseConnection } from "#lib/server/db/database.js";
import * as schema from "#lib/server/db/schema.js";
import { emails } from "#lib/server/notifications/emails.js";
import { mailer } from "#lib/server/notifications/mailer.js";

const logger = new Logger("Auth");

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

const passkeySignInPaths = new Set([
	"/passkey/generate-authenticate-options",
	"/passkey/verify-authentication",
]);

const passwordResetPaths = new Set([
	"/request-password-reset",
	"/reset-password",
]);

const magicLinkPaths = new Set(["/sign-in/magic-link", "/magic-link/verify"]);
const emailCodePaths = new Set([
	"/email-otp/send-verification-otp",
	"/sign-in/email-otp",
]);

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

const secondFactorSkippingPaths = [
	"/callback/",
	"/magic-link/verify",
	"/sign-in/email-otp",
];

type MiddlewareContext = Parameters<
	Parameters<typeof createAuthMiddleware>[0]
>[0];

/** The better-auth instance and the origin it answers on, rebuilt whenever the settings it's built from change. */
class AuthService {
	#instance: { auth: Auth; key: string } | undefined;

	/**
	 * The better-auth instance, created on first use so a build never opens the database or needs the secret, and rebuilt
	 * when an admin changes the single sign-on providers, the sign-up policy or the session lifetime, or the origin it is
	 * reached at changes: the public origin, else the request's, which the MCP server's OAuth endpoints are built from.
	 */
	get(): Auth {
		const providers = getSetting("ssoProviders");
		const signUpsEnabled = getSetting("signUpsEnabled");
		const sessionDays = getSetting("sessionDays");
		const origin = this.publicOrigin() ?? this.#requestOrigin();
		const key = JSON.stringify([
			providers,
			signUpsEnabled,
			sessionDays,
			origin,
		]);
		if (this.#instance?.key !== key) {
			this.#instance = {
				auth: this.build(providers, signUpsEnabled, sessionDays, origin),
				key,
			};
		}
		return this.#instance.auth;
	}

	/**
	 * The public origin links in emails and passkeys use: `ORIGIN`, else the one recorded at setup or by an admin. Ignored
	 * in dev, where Vite serves the real one.
	 */
	publicOrigin(): string | undefined {
		if (dev) {
			return undefined;
		}
		return (
			configuration.get().origin ?? getSetting("publicOrigin") ?? undefined
		);
	}

	/** Records `origin` as the public origin when nothing pins one yet, from a request only an admin or setup makes. */
	rememberPublicOrigin(origin: string): void {
		if (!dev && !configuration.get().origin && !getSetting("publicOrigin")) {
			setSetting("publicOrigin", origin);
		}
	}

	/** The address AI apps reach the MCP server at on `origin`, or none when it isn't HTTPS or localhost, which OAuth requires. */
	mcpResource(origin: string | undefined): string | undefined {
		if (!origin) {
			return undefined;
		}
		const url = new URL("/mcp", origin);
		return url.protocol === "https:" || loopbackHosts.has(url.hostname)
			? url.href
			: undefined;
	}

	/** Routes a better-auth log line through the app logger, dropping the "Base URL is not set" warning the request-derived origin causes. */
	forwardLog(
		level: "debug" | "info" | "warn" | "error",
		message: string,
		...args: unknown[]
	): void {
		if (message.includes("Base URL is not set")) {
			return;
		}
		logger[level](message, ...args);
	}

	/** Builds a better-auth instance for these settings; `get()` caches it. */
	build(
		providers: SsoProvider[],
		signUpsEnabled: boolean,
		sessionDays: number,
		origin: string | undefined,
	) {
		return betterAuth({
			appName: "OpenCount",
			baseURL: origin,
			trustedOrigins: origin ? [origin] : [],
			secret: configuration.get().auth.secret,
			database: drizzleAdapter(databaseConnection.get(), {
				provider: "sqlite",
				schema,
			}),
			...this.#sessionOptions(sessionDays, origin),
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
					emails.queue(emails.resetPassword(user.email, url));
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
			hooks: {
				before: createAuthMiddleware((context) => this.#guard(context)),
			},
			onAPIError: { errorURL: resolve("/auth/sign-in") },
			telemetry: { enabled: false },
			logger: {
				log: (level, message, ...args) =>
					this.forwardLog(level, message, ...args),
			},
			plugins: [
				twoFactor({ issuer: "OpenCount" }),
				passkey({ rpName: "OpenCount" }),
				magicLink({
					disableSignUp: true,
					expiresIn: 600,
					sendMagicLink: ({ email, url }) => {
						if (!this.#usesAuthenticator(email)) {
							emails.queue(emails.magicLink(email, url));
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
						if (type === "sign-in" && !this.#usesAuthenticator(email)) {
							emails.queue(emails.signInCode(email, otp));
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
						clientSecret: secrets.decrypt(provider.encryptedClientSecret),
						scopes: ["openid", "email", "profile"],
						pkce: true,
						disableImplicitSignUp: !signUpsEnabled,
					})),
				}),
				...this.#aiAppPlugins(this.mcpResource(origin)),
				sveltekitCookies(getRequestEvent),
			],
		});
	}

	/**
	 * Refuses a request the sign-in settings or the session don't allow: a page the browser opened goes back to sign-in
	 * with why, a call gets the error.
	 *
	 * @throws The refusal, or a redirect to sign-in.
	 */
	async #guard(context: MiddlewareContext): Promise<void> {
		const error =
			(await this.#sessionRefusal(context)) ?? this.#refusal(context);
		if (!error) {
			return;
		}
		const browsing =
			context.request?.method === "GET" &&
			(context.request.headers.get("accept") ?? "").includes("text/html");
		if (browsing) {
			throw context.redirect(
				`${resolve("/auth/sign-in")}?error=${error.status === "NOT_FOUND" ? "not_found" : "method_off"}`,
			);
		}
		throw error;
	}

	/** The origin of the request being handled, or `undefined` outside one. */
	#requestOrigin(): string | undefined {
		try {
			return getRequestEvent().url.origin;
		} catch {
			return undefined;
		}
	}

	/** The plugins that let AI apps sign in over OAuth and reach `/mcp`, none without a usable `resource`. */
	#aiAppPlugins(resource: string | undefined) {
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

	/** Why an email link or code request is refused: the method is off, email isn't set up, or it isn't for signing in. */
	#emailRefusal(
		setting: "magicLinkSignIn" | "emailCodeSignIn",
		body: { type?: unknown } | undefined,
	): APIError | undefined {
		if (!signInMethods.isOn(setting) || !mailer.isConfigured()) {
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
	#usesAuthenticator(email: string): boolean {
		const userId = UserDTO.idForEmail(email.trim().toLowerCase());
		return userId !== undefined && UserDTO.twoFactorEnabled(userId);
	}

	/** Why a request uses a sign-in method an admin turned off, if it does. */
	#refusal(context: {
		path: string;
		params?: Record<string, string | undefined>;
		body?: { provider?: unknown; email?: unknown; type?: unknown };
	}): APIError | undefined {
		if (magicLinkPaths.has(context.path)) {
			return this.#emailRefusal("magicLinkSignIn", context.body);
		}
		if (emailCodePaths.has(context.path)) {
			return this.#emailRefusal("emailCodeSignIn", context.body);
		}
		if (
			passwordResetPaths.has(context.path) &&
			(!signInMethods.isOn("passwordSignIn") || !mailer.isConfigured())
		) {
			return new APIError("FORBIDDEN", {
				message: "Password resets are turned off on this server.",
			});
		}
		if (
			context.path === "/sign-in/email" &&
			!signInMethods.isOn("passwordSignIn")
		) {
			return new APIError("FORBIDDEN", {
				message: "Password sign-in is turned off on this server.",
			});
		}
		if (
			passkeySignInPaths.has(context.path) &&
			!signInMethods.isOn("passkeySignIn")
		) {
			return new APIError("FORBIDDEN", {
				message: "Passkey sign-in is turned off on this server.",
			});
		}
		if (
			context.path === "/sign-in/social" ||
			context.path.startsWith("/callback/")
		) {
			const providerId = context.path.startsWith("/callback/")
				? (context.params?.id ?? "")
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

	/**
	 * Refuses any better-auth endpoint the browser has no reason to call directly (form actions call them with their own
	 * limits), every call from a locked session but signing out, and passkey registration without a recent sign-in.
	 */
	async #sessionRefusal(
		context: MiddlewareContext,
	): Promise<APIError | undefined> {
		if (
			context.request &&
			!browserPaths.some((path) => context.path.startsWith(path))
		) {
			return new APIError("NOT_FOUND", { message: "Not found." });
		}
		const event: RequestEvent | undefined = getRequestEvent();
		if (
			event?.locals.gate?.reason === "locked" &&
			context.path !== "/sign-out"
		) {
			return new APIError("UNAUTHORIZED", {
				message: "Unlock OpenCount first.",
			});
		}
		if (!passkeyRegistrationPaths.has(context.path)) {
			return undefined;
		}
		const current = await getSessionFromCtx(context);
		if (current && !securityPolicy.signedInRecently(current.session)) {
			return new APIError("FORBIDDEN", {
				message: securityPolicy.recentSignInMessage,
			});
		}
		return undefined;
	}

	/** Stops a single sign-on, email link or email code sign-in from skipping an authenticator app the account set up. */
	#refuseSkippedSecondFactor(
		userId: string,
		context: { path?: string } | null | undefined,
	): Promise<void> {
		if (
			secondFactorSkippingPaths.some((path) =>
				context?.path?.startsWith(path),
			) &&
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
	#sessionOptions(sessionDays: number, origin: string | undefined) {
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
						) => this.#refuseSkippedSecondFactor(session.userId, context),
					},
				},
			},
		};
	}
}

export type Auth = ReturnType<AuthService["build"]>;
export type Session = Auth["$Infer"]["Session"];

export const authService = new AuthService();
