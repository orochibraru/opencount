import { createSign } from "node:crypto";

import type { BankCredentials } from "#lib/dto/bank-credential.js";
import { decryptSecret } from "#lib/server/secrets.js";
import { withSpan } from "#lib/server/telemetry.js";

const apiBase = "https://api.enablebanking.com";
const consentDays = 90;

export const bankLinkPurpose = "bank-link";

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
}

export interface BankLink {
	sessionId: string;
	bankName: string;
	bankCountry: string;
	accounts: BankAccount[];
	validUntil: Date;
}

export interface BankTransaction {
	transaction_id?: string | null;
	entry_reference?: string | null;
	transaction_amount: { amount: string; currency: string };
	credit_debit_indicator: "CRDT" | "DBIT";
	status?: string | null;
	booking_date?: string | null;
	value_date?: string | null;
	transaction_date?: string | null;
	remittance_information?: string[] | null;
	creditor?: { name?: string | null } | null;
	debtor?: { name?: string | null } | null;
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

function call<Result>(
	credentials: BankCredentials,
	path: string,
	init: RequestInit = {},
): Promise<Result> {
	return withSpan(
		"enable banking",
		{ "bank.path": path.split("?")[0] ?? "" },
		async () => {
			const headers = new Headers(init.headers);
			headers.set("Authorization", `Bearer ${bearerToken(credentials)}`);
			headers.set("Content-Type", "application/json");
			const response = await fetch(`${apiBase}${path}`, {
				...init,
				headers,
				signal: AbortSignal.timeout(20_000),
			});
			const body = (await response.json().catch(() => ({}))) as Result & {
				message?: string;
			};
			if (!response.ok) {
				throw new BankError(
					body.message ?? `The bank service answered ${response.status}.`,
				);
			}
			return body;
		},
	);
}

/**
 * The name of the Enable Banking application `credentials` belong to, to check the keys work.
 *
 * @throws BankError when the keys are refused.
 */
export async function bankApplicationName(
	credentials: BankCredentials,
): Promise<string> {
	return (await call<{ name: string }>(credentials, "/application")).name;
}

/** The banks personal accounts can be linked at in `country`. */
export async function listBanks(
	credentials: BankCredentials,
	country: string,
): Promise<Bank[]> {
	const { aspsps } = await call<{
		aspsps: { name: string; country: string; logo?: string | null }[];
	}>(
		credentials,
		`/aspsps?country=${encodeURIComponent(country)}&psu_type=personal&service=AIS`,
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
	const { url } = await call<{ url: string }>(credentials, "/auth", {
		method: "POST",
		body: JSON.stringify({
			access: { valid_until: validUntil.toISOString() },
			aspsp: bank,
			state,
			redirect_url: redirectUrl,
			psu_type: "personal",
		}),
	});
	return url;
}

/**
 * Turns the code the bank sent back into a session with its accounts.
 *
 * @throws BankError when the code is refused or expired.
 */
export async function openBankSession(
	credentials: BankCredentials,
	code: string,
): Promise<BankLink> {
	const session = await call<{
		session_id: string;
		aspsp: { name: string; country: string };
		access: { valid_until: string };
		accounts: {
			uid: string;
			name?: string | null;
			details?: string | null;
			product?: string | null;
			currency?: string | null;
			account_id?: { iban?: string | null } | null;
		}[];
	}>(credentials, "/sessions", {
		method: "POST",
		body: JSON.stringify({ code }),
	});
	return {
		sessionId: session.session_id,
		bankName: session.aspsp.name,
		bankCountry: session.aspsp.country,
		validUntil: new Date(session.access.valid_until),
		accounts: session.accounts.map((account) => ({
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
		})),
	};
}

/** Every transaction of account `uid` from `dateFrom` on, following the pages. */
export async function bankTransactions(
	credentials: BankCredentials,
	uid: string,
	dateFrom: string,
): Promise<BankTransaction[]> {
	const transactions: BankTransaction[] = [];
	let continuationKey: string | undefined;
	do {
		const query = new URLSearchParams({ date_from: dateFrom });
		if (continuationKey) {
			query.set("continuation_key", continuationKey);
		}
		const page = await call<{
			transactions: BankTransaction[];
			continuation_key?: string | null;
		}>(
			credentials,
			`/accounts/${encodeURIComponent(uid)}/transactions?${query}`,
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
	await call(credentials, `/sessions/${encodeURIComponent(sessionId)}`, {
		method: "DELETE",
	}).catch(() => undefined);
}
