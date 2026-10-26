import type { Cookies } from "@sveltejs/kit";

import { signPayload, verifyPayload } from "#lib/server/secrets.js";

const pendingCookie = "opencount_signup_pending";
const ticketCookie = "opencount_signup_ticket";
const setupCookie = "opencount_setup_ticket";
const pendingTtlMs = 15 * 60 * 1000;
const ticketTtlMs = 30 * 60 * 1000;

function cookieOptions(url: URL, ttlMs: number) {
	return {
		path: "/auth",
		httpOnly: true,
		sameSite: "lax" as const,
		secure: url.protocol === "https:",
		maxAge: ttlMs / 1000,
	};
}

export type SignUpStep =
	| { step: "email" }
	| { step: "code"; email: string }
	| { step: "details"; email: string };

/** Where a visitor is in the sign-up stepper, from its signed cookies. */
export function currentSignUpStep(cookies: Cookies): SignUpStep {
	const ticket = verifyPayload(cookies.get(ticketCookie), "signup-ticket");
	if (typeof ticket?.email === "string") {
		return { step: "details", email: ticket.email };
	}
	const pending = verifyPayload(cookies.get(pendingCookie), "signup-pending");
	if (typeof pending?.email === "string") {
		return { step: "code", email: pending.email };
	}
	return { step: "email" };
}

/** Remembers that a code was sent to `email`. */
export function rememberPendingSignUp(
	cookies: Cookies,
	url: URL,
	email: string,
): void {
	cookies.set(
		pendingCookie,
		signPayload({ email }, "signup-pending", pendingTtlMs),
		cookieOptions(url, pendingTtlMs),
	);
}

/** Swaps the pending cookie for a ticket proving `email` was verified. */
export function grantSignUpTicket(
	cookies: Cookies,
	url: URL,
	email: string,
): void {
	cookies.delete(pendingCookie, { path: "/auth" });
	cookies.set(
		ticketCookie,
		signPayload({ email }, "signup-ticket", ticketTtlMs),
		cookieOptions(url, ticketTtlMs),
	);
}

/** Forgets every sign-up step. */
export function clearSignUp(cookies: Cookies): void {
	cookies.delete(pendingCookie, { path: "/auth" });
	cookies.delete(ticketCookie, { path: "/auth" });
}

/** Remembers that this browser entered the setup code. */
export function grantSetupTicket(cookies: Cookies, url: URL): void {
	cookies.set(
		setupCookie,
		signPayload({}, "setup-ticket", ticketTtlMs),
		cookieOptions(url, ticketTtlMs),
	);
}

/** Whether this browser entered the setup code recently. */
export function hasSetupTicket(cookies: Cookies): boolean {
	return verifyPayload(cookies.get(setupCookie), "setup-ticket") !== undefined;
}

/** Forgets the setup step. */
export function clearSetupTicket(cookies: Cookies): void {
	cookies.delete(setupCookie, { path: "/auth" });
}
