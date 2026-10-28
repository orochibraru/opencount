import { createSign } from "node:crypto";

import createClient from "openapi-fetch";

import type { BankCredentials } from "#lib/dto/bank-credential.js";
import { currencyDigits } from "#lib/money.js";
import type {
	paths,
	Transaction,
} from "#lib/server/banking/enable-banking-api.js";
import { secrets } from "#lib/server/core/secrets.js";
import { telemetry } from "#lib/server/core/telemetry.js";
import { isMoneyAside } from "#lib/smart-category.js";

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
	savings?: boolean;
}

export interface BankBalance {
	minor: number;
	currency: string;
}

const balancePreference = [
	"ITAV",
	"CLAV",
	"ITBD",
	"CLBD",
	"XPCD",
	"OPAV",
	"OPBD",
	"VALU",
	"PRCD",
	"FWAV",
	"INFO",
	"OTHR",
];

export interface BankLink {
	sessionId: string;
	bankName: string;
	bankCountry: string;
	accounts: BankAccount[];
	listedAccounts: number;
	validUntil: Date;
}

/** Enable Banking's API as one account's application, signed with that account's private key. */
export class EnableBankingClient {
	readonly #credentials: BankCredentials;

	/** A client acting as the Enable Banking application `credentials` belong to. */
	constructor(credentials: BankCredentials) {
		this.#credentials = credentials;
	}

	/**
	 * The name of the Enable Banking application, to check the keys work.
	 *
	 * @throws BankError when the keys are refused.
	 */
	async applicationName(): Promise<string> {
		return (
			await this.#call("/application", () => this.#api().GET("/application"))
		).name;
	}

	/** The banks personal accounts can be linked at in `country`. */
	async listBanks(country: string): Promise<Bank[]> {
		const { aspsps } = await this.#call("/aspsps", () =>
			this.#api().GET("/aspsps", {
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
	async startLink(
		bank: { name: string; country: string },
		redirectUrl: string,
		state: string,
	): Promise<string> {
		const validUntil = new Date(Date.now() + consentDays * 24 * 60 * 60 * 1000);
		const { url } = await this.#call("/auth", () =>
			this.#api().POST("/auth", {
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
	async openSession(code: string): Promise<BankLink> {
		const session = await this.#call("/sessions", () =>
			this.#api().POST("/sessions", { body: { code } }),
		);
		return {
			sessionId: session.session_id,
			bankName: session.aspsp.name,
			bankCountry: session.aspsp.country,
			validUntil: new Date(session.access.valid_until),
			listedAccounts: session.accounts.length,
			accounts: session.accounts.flatMap((account) => {
				if (!account.uid) {
					return [];
				}
				const name =
					account.details ??
					account.product ??
					(account.account_id?.iban
						? `…${account.account_id.iban.slice(-4)}`
						: null) ??
					account.name ??
					"Account";
				return [
					{
						uid: account.uid,
						name,
						currency: account.currency ?? "EUR",
						identificationHash: account.identification_hash,
						savings:
							account.cash_account_type === "SVGS" ||
							isMoneyAside(
								[name, account.product, account.name].filter(Boolean).join(" "),
							),
					},
				];
			}),
		};
	}

	/**
	 * The identification hash of each account of session `sessionId` by uid, empty when the session can't be read
	 * anymore.
	 */
	async sessionAccountHashes(sessionId: string): Promise<Map<string, string>> {
		const session = await this.#call("/sessions/{session_id}", () =>
			this.#api().GET("/sessions/{session_id}", {
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

	/** The balance of account `uid` the bank reports first among available and booked ones, `undefined` when none. */
	async balance(uid: string): Promise<BankBalance | undefined> {
		const { balances } = await this.#call(
			"/accounts/{account_id}/balances",
			() =>
				this.#api().GET("/accounts/{account_id}/balances", {
					params: { path: { account_id: uid } },
				}),
		);
		const best = balances.toSorted(
			(left, right) =>
				this.#rank(left.balance_type) - this.#rank(right.balance_type),
		)[0];
		if (!best) {
			return undefined;
		}
		const { amount, currency } = best.balance_amount;
		const minor = Math.round(Number(amount) * 10 ** currencyDigits(currency));
		return Number.isFinite(minor) ? { minor, currency } : undefined;
	}

	/**
	 * The logo of bank `name` in `country`, an https address, or `undefined` when the bank lists none.
	 *
	 * @throws BankError when the application is refused.
	 */
	async bankLogo(name: string, country: string): Promise<string | undefined> {
		return (
			(await this.listBanks(country)).find((bank) => bank.name === name)
				?.logo ?? undefined
		);
	}

	/**
	 * Every transaction of account `uid` from `dateFrom` on, following the pages; with no `dateFrom`, as far back as the
	 * bank lets Enable Banking go.
	 */
	async transactions(
		uid: string,
		dateFrom: string | undefined,
	): Promise<Transaction[]> {
		const api = this.#api();
		const transactions: Transaction[] = [];
		let continuationKey: string | undefined;
		do {
			const key = continuationKey;
			const page = await this.#call("/accounts/{account_id}/transactions", () =>
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
	async closeSession(sessionId: string): Promise<void> {
		await this.#api()
			.DELETE("/sessions/{session_id}", {
				params: { path: { session_id: sessionId } },
			})
			.catch(() => undefined);
	}

	/** A typed API client carrying a fresh bearer token. */
	#api() {
		return createClient<paths>({
			baseUrl: apiBase,
			headers: { Authorization: `Bearer ${this.#bearerToken()}` },
			fetch: (request) =>
				fetch(request, { signal: AbortSignal.timeout(20_000) }),
		});
	}

	/** An hour-long RS256 JWT for the application, signed with its decrypted private key. */
	#bearerToken(): string {
		const now = Math.floor(Date.now() / 1000);
		const unsigned = `${this.#base64url(
			JSON.stringify({
				typ: "JWT",
				alg: "RS256",
				kid: this.#credentials.applicationId,
			}),
		)}.${this.#base64url(
			JSON.stringify({
				iss: "enablebanking.com",
				aud: "api.enablebanking.com",
				iat: now,
				exp: now + 3600,
			}),
		)}`;
		const signature = createSign("RSA-SHA256")
			.update(unsigned)
			.sign(secrets.decrypt(this.#credentials.encryptedPrivateKey));
		return `${unsigned}.${this.#base64url(signature)}`;
	}

	/** Where balance type `type` comes in `balancePreference`, unknown ones last. */
	#rank(type: string): number {
		const index = balancePreference.indexOf(type);
		return index === -1 ? balancePreference.length : index;
	}

	/** `value` encoded as unpadded base64url. */
	#base64url(value: string | Buffer): string {
		return Buffer.from(value).toString("base64url");
	}

	/**
	 * Sends one request inside a span and returns its data.
	 *
	 * @throws BankError with the service's message when it answers without data.
	 */
	#call<Data>(
		path: string,
		send: () => Promise<{ data?: Data; error?: unknown; response: Response }>,
	): Promise<Data> {
		return telemetry.withSpan(
			"enable banking",
			{ "bank.path": path },
			async () => {
				const { data, error, response } = await send();
				if (data === undefined) {
					throw new BankError(
						this.#refusal(error) ??
							`The bank service answered ${response.status}.`,
					);
				}
				return data;
			},
		);
	}

	/** The message in an error body the service sent, if it has one. */
	#refusal(error: unknown): string | undefined {
		return typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof error.message === "string"
			? error.message
			: undefined;
	}
}
