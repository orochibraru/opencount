import { createSign } from "node:crypto";

import createClient from "openapi-fetch";

import type { BankCredentials } from "#lib/dto/bank-credential.js";
import type { paths, Transaction } from "#lib/server/enable-banking-api.js";
import { decryptSecret } from "#lib/server/secrets.js";
import { withSpan } from "#lib/server/telemetry.js";

const apiBase = "https://api.enablebanking.com";
const consentDays = 90;

export const bankLinkPurpose = "bank-link";

export const noReadableAccount =
	"Enable Banking can't read any account at this bank. If your app was activated by linking your own accounts, add these accounts in the Enable Banking control panel, then relink the bank.";

export class BankError extends Error {}

export interface Bank {
	name: string;
	country: string;
	logo: string | null;
}

export interface BankAccount {
	uid: string;
	name: string;
	currency: string;
	identificationHash?: string;
}

export interface BankLink {
	sessionId: string;
	bankName: string;
	bankCountry: string;
	accounts: BankAccount[];
	listedAccounts: number;
	validUntil: Date;
}

function base64url(value: string | Buffer): string {
	return Buffer.from(value).toString("base64url");
}

function bearerToken(credentials: BankCredentials): string {
	const now = Math.floor(Date.now() / 1000);
	const unsigned = `${base64url(
		JSON.stringify({
			typ: "JWT",
			alg: "RS256",
			kid: credentials.applicationId,
		}),
	)}.${base64url(
		JSON.stringify({
			iss: "enablebanking.com",
			aud: "api.enablebanking.com",
			iat: now,
			exp: now + 3600,
		}),
	)}`;
	const signature = createSign("RSA-SHA256")
		.update(unsigned)
		.sign(decryptSecret(credentials.encryptedPrivateKey));
	return `${unsigned}.${base64url(signature)}`;
}

function client(credentials: BankCredentials) {
	return createClient<paths>({
		baseUrl: apiBase,
		headers: { Authorization: `Bearer ${bearerToken(credentials)}` },
		fetch: (request) => fetch(request, { signal: AbortSignal.timeout(20_000) }),
	});
}

function refusal(error: unknown): string | undefined {
	return typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
		? error.message
		: undefined;
}

function call<Data>(
	path: string,
	send: () => Promise<{ data?: Data; error?: unknown; response: Response }>,
): Promise<Data> {
	return withSpan("enable banking", { "bank.path": path }, async () => {
		const { data, error, response } = await send();
		if (data === undefined) {
			throw new BankError(
				refusal(error) ?? `The bank service answered ${response.status}.`,
			);
		}
		return data;
	});
}

/**
 * The name of the Enable Banking application `credentials` belong to, to check the keys work.
 *
 * @throws BankError when the keys are refused.
 */
export async function bankApplicationName(
	credentials: BankCredentials,
): Promise<string> {
	return (
		await call("/application", () => client(credentials).GET("/application"))
	).name;
}

/** The banks personal accounts can be linked at in `country`. */
export async function listBanks(
	credentials: BankCredentials,
	country: string,
): Promise<Bank[]> {
	const { aspsps } = await call("/aspsps", () =>
		client(credentials).GET("/aspsps", {
			params: { query: { country, psu_type: "personal", service: "AIS" } },
		}),
	);
	return aspsps.map((aspsp) => ({
		name: aspsp.name,
		country: aspsp.country,
		logo: aspsp.logo?.startsWith("https://") ? aspsp.logo : null,
	}));
}

/**
 * Starts linking a bank: the address of the bank's own consent screen, which sends the person back to `redirectUrl`
 * with a code and `state`.
 *
 * @throws BankError when the bank or the application refuses.
 */
export async function startBankLink(
	credentials: BankCredentials,
	bank: { name: string; country: string },
	redirectUrl: string,
	state: string,
): Promise<string> {
	const validUntil = new Date(Date.now() + consentDays * 24 * 60 * 60 * 1000);
	const { url } = await call("/auth", () =>
		client(credentials).POST("/auth", {
			body: {
				access: { valid_until: validUntil.toISOString() },
				aspsp: bank,
				state,
				redirect_url: redirectUrl,
				psu_type: "personal",
			},
		}),
	);
	return url;
}

/**
 * Turns the code the bank sent back into a session with the accounts it can read, and how many the bank listed.
 *
 * @throws BankError when the code is refused or expired.
 */
export async function openBankSession(
	credentials: BankCredentials,
	code: string,
): Promise<BankLink> {
	const session = await call("/sessions", () =>
		client(credentials).POST("/sessions", { body: { code } }),
	);
	return {
		sessionId: session.session_id,
		bankName: session.aspsp.name,
		bankCountry: session.aspsp.country,
		validUntil: new Date(session.access.valid_until),
		listedAccounts: session.accounts.length,
		accounts: session.accounts.flatMap((account) =>
			account.uid
				? [
						{
							uid: account.uid,
							name:
								account.details ??
								account.product ??
								(account.account_id?.iban
									? `…${account.account_id.iban.slice(-4)}`
									: null) ??
								account.name ??
								"Account",
							currency: account.currency ?? "EUR",
							identificationHash: account.identification_hash,
						},
					]
				: [],
		),
	};
}

/**
 * The identification hash of each account of session `sessionId` by uid, empty when the session can't be read
 * anymore.
 */
export async function sessionAccountHashes(
	credentials: BankCredentials,
	sessionId: string,
): Promise<Map<string, string>> {
	const session = await call("/sessions/{session_id}", () =>
		client(credentials).GET("/sessions/{session_id}", {
			params: { path: { session_id: sessionId } },
		}),
	).catch(() => undefined);
	return new Map(
		session?.accounts_data.map((account) => [
			account.uid,
			account.identification_hash,
		]) ?? [],
	);
}

/**
 * The logo of bank `name` in `country`, an https address, or `undefined` when the bank lists none.
 *
 * @throws BankError when the application is refused.
 */
export async function bankLogo(
	credentials: BankCredentials,
	name: string,
	country: string,
): Promise<string | undefined> {
	return (
		(await listBanks(credentials, country)).find((bank) => bank.name === name)
			?.logo ?? undefined
	);
}

/**
 * Every transaction of account `uid` from `dateFrom` on, following the pages; with no `dateFrom`, as far back as the
 * bank lets Enable Banking go.
 */
export async function bankTransactions(
	credentials: BankCredentials,
	uid: string,
	dateFrom: string | undefined,
): Promise<Transaction[]> {
	const api = client(credentials);
	const transactions: Transaction[] = [];
	let continuationKey: string | undefined;
	do {
		const key = continuationKey;
		const page = await call("/accounts/{account_id}/transactions", () =>
			api.GET("/accounts/{account_id}/transactions", {
				params: {
					path: { account_id: uid },
					query: {
						...(dateFrom ? { date_from: dateFrom } : { strategy: "longest" }),
						...(key ? { continuation_key: key } : {}),
					},
				},
			}),
		);
		transactions.push(...page.transactions);
		continuationKey = page.continuation_key ?? undefined;
	} while (continuationKey);
	return transactions;
}

/** Ends a bank session, which closes the consent at the bank when it can; failures are ignored. */
export async function closeBankSession(
	credentials: BankCredentials,
	sessionId: string,
): Promise<void> {
	await client(credentials)
		.DELETE("/sessions/{session_id}", {
			params: { path: { session_id: sessionId } },
		})
		.catch(() => undefined);
}
