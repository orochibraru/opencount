import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	hkdfSync,
	randomBytes,
	randomInt,
	timingSafeEqual,
} from "node:crypto";

import { getConfig } from "#lib/server/config.js";

function authSecret(): string {
	return getConfig().auth.secret;
}

function derivedKey(purpose: string): Buffer {
	return Buffer.from(
		hkdfSync("sha256", authSecret(), "opencount", purpose, 32),
	);
}

/** Encrypts a secret for storage with AES-256-GCM under a key derived from `AUTH_SECRET`. */
export function encryptSecret(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", derivedKey("settings"), iv);
	const encrypted = Buffer.concat([
		cipher.update(plain, "utf8"),
		cipher.final(),
	]);
	return [iv, encrypted, cipher.getAuthTag()]
		.map((part) => part.toString("base64url"))
		.join(".");
}

/**
 * Decrypts a value written by `encryptSecret`.
 *
 * @throws When the value was tampered with or `AUTH_SECRET` changed since it was written.
 */
export function decryptSecret(stored: string): string {
	const [iv, encrypted, tag] = stored
		.split(".")
		.map((part) => Buffer.from(part, "base64url"));
	if (!iv || !encrypted || !tag) {
		throw new Error("Malformed encrypted value");
	}
	const decipher = createDecipheriv("aes-256-gcm", derivedKey("settings"), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
		"utf8",
	);
}

/** A random URL-safe token with 256 bits of entropy. */
export function randomToken(): string {
	return randomBytes(32).toString("base64url");
}

/** A random six-digit code. */
export function randomCode(): string {
	return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** The SHA-256 HMAC of `value` under `AUTH_SECRET`, for storing tokens and codes without keeping them readable. */
export function hashToken(value: string): string {
	return createHmac("sha256", derivedKey("tokens"))
		.update(value)
		.digest("base64url");
}

/** Signs a JSON payload with an expiry, for short-lived cookies. */
export function signPayload(
	payload: Record<string, unknown>,
	purpose: string,
	ttlMs: number,
): string {
	const body = Buffer.from(
		JSON.stringify({ ...payload, purpose, expiresAt: Date.now() + ttlMs }),
	).toString("base64url");
	return `${body}.${hashToken(body)}`;
}

/** The payload of a value from `signPayload`, or `undefined` when it's forged, for another purpose or expired. */
export function verifyPayload(
	signed: string | undefined,
	purpose: string,
): Record<string, unknown> | undefined {
	const [body, signature] = signed?.split(".") ?? [];
	if (!body || !signature) {
		return undefined;
	}
	const expected = Buffer.from(hashToken(body));
	const actual = Buffer.from(signature);
	if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
		return undefined;
	}
	const payload = JSON.parse(
		Buffer.from(body, "base64url").toString("utf8"),
	) as Record<string, unknown>;
	if (
		payload.purpose !== purpose ||
		typeof payload.expiresAt !== "number" ||
		payload.expiresAt < Date.now()
	) {
		return undefined;
	}
	return payload;
}
