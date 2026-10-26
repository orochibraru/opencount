import { hasLinkedProvider } from "#lib/dto/account.js";
import { PasskeyDTO } from "#lib/dto/passkey.js";
import { allSettings, type SsoProvider } from "#lib/dto/setting.js";

export interface SignInMethods {
	password: boolean;
	passkey: boolean;
	sso: Pick<SsoProvider, "id" | "name">[];
}

/** The sign-in methods an admin left on, with only the enabled single sign-on providers. */
export function enabledSignInMethods(): SignInMethods {
	const settings = allSettings();
	return {
		password: settings.passwordSignIn,
		passkey: settings.passkeySignIn,
		sso: settings.ssoProviders
			.filter((provider) => provider.enabled)
			.map(({ id, name }) => ({ id, name })),
	};
}

/** Which of the enabled methods `userId` could sign in with right now. */
export function usableMethods(
	userId: string,
	methods: SignInMethods,
): string[] {
	const usable: string[] = [];
	if (methods.password) {
		usable.push("password");
	}
	if (methods.passkey && PasskeyDTO.forUser(userId).length > 0) {
		usable.push("passkey");
	}
	if (
		hasLinkedProvider(
			userId,
			methods.sso.map((provider) => provider.id),
		)
	) {
		usable.push("sso");
	}
	return usable;
}

/** A URL-safe id for a provider name, used in its callback URL. */
export function providerSlug(name: string): string {
	return (
		name
			.toLowerCase()
			.normalize("NFKD")
			.replaceAll(/\p{Diacritic}/gu, "")
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replaceAll(/^-|-$/g, "")
			.slice(0, 40) || "sso"
	);
}
