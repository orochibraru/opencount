import { eq } from "drizzle-orm";

import { getDb } from "#lib/server/db/lib.js";
import { setting } from "#lib/server/db/schema.js";

export const smtpSecurityModes = ["tls", "starttls", "none"] as const;

export interface SmtpSettings {
	host: string;
	port: number;
	security: (typeof smtpSecurityModes)[number];
	username: string;
	encryptedPassword: string;
	fromAddress: string;
	fromName: string;
}

export interface OcrSettings {
	languages: string[];
}

export interface SsoProvider {
	id: string;
	name: string;
	discoveryUrl: string;
	clientId: string;
	encryptedClientSecret: string;
	enabled: boolean;
}

export interface VapidKeys {
	publicKey: string;
	encryptedPrivateKey: string;
}

export interface SettingValues {
	signUpsEnabled: boolean;
	requireTwoFactor: boolean;
	requirePasskey: boolean;
	smtp: SmtpSettings | null;
	ocr: OcrSettings | null;
	passwordSignIn: boolean;
	passkeySignIn: boolean;
	magicLinkSignIn: boolean;
	emailCodeSignIn: boolean;
	ssoProviders: SsoProvider[];
	vapid: VapidKeys | null;
}

const defaults: SettingValues = {
	signUpsEnabled: false,
	requireTwoFactor: false,
	requirePasskey: false,
	smtp: null,
	ocr: null,
	passwordSignIn: true,
	passkeySignIn: true,
	magicLinkSignIn: false,
	emailCodeSignIn: false,
	ssoProviders: [],
	vapid: null,
};

/** The stored value of `key`, or its default. */
export function getSetting<Key extends keyof SettingValues>(
	key: Key,
): SettingValues[Key] {
	const row = getDb()
		.select({ value: setting.value })
		.from(setting)
		.where(eq(setting.key, key))
		.get();
	return row ? (row.value as SettingValues[Key]) : defaults[key];
}

/** Every setting, defaults filled in. */
export function allSettings(): SettingValues {
	return {
		signUpsEnabled: getSetting("signUpsEnabled"),
		requireTwoFactor: getSetting("requireTwoFactor"),
		requirePasskey: getSetting("requirePasskey"),
		smtp: getSetting("smtp"),
		ocr: getSetting("ocr"),
		passwordSignIn: getSetting("passwordSignIn"),
		passkeySignIn: getSetting("passkeySignIn"),
		magicLinkSignIn: getSetting("magicLinkSignIn"),
		emailCodeSignIn: getSetting("emailCodeSignIn"),
		ssoProviders: getSetting("ssoProviders"),
		vapid: getSetting("vapid"),
	};
}

/** Stores `value` for `key`. */
export function setSetting<Key extends keyof SettingValues>(
	key: Key,
	value: SettingValues[Key],
): void {
	getDb()
		.insert(setting)
		.values({ key, value })
		.onConflictDoUpdate({
			target: setting.key,
			set: { value, updatedAt: new Date() },
		})
		.run();
}
