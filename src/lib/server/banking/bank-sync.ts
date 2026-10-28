import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import {
	type BankCredentials,
	bankCredentialsFor,
} from "#lib/dto/bank-credential.js";
import { JobDTO } from "#lib/dto/job.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import {
	type BankExpense,
	internalCategory,
	PersonalExpenseDTO,
	type TransferLine,
} from "#lib/dto/personal-expense.js";
import { getSetting } from "#lib/dto/setting.js";
import { currencyDigits } from "#lib/money.js";
import type { Transaction } from "#lib/server/banking/enable-banking-api.js";
import {
	BankError,
	type BankLink,
	EnableBankingClient,
	noReadableAccount,
} from "#lib/server/banking/enable-banking.js";
import type { BankSyncReport } from "#lib/server/db/schema.js";
import { similarKey } from "#lib/similar-key.js";
import { guessCategory, isMoneyAside } from "#lib/smart-category.js";

const cardLine =
	/^(?:PAIEMENT|PAIE|ACHAT)\s+(?:CB|MOB|PSC|CARTE)?\s*(\d{2})(\d{2})\b/i;

const merchantCategories: [number[], string][] = [
	[[5411, 5422, 5441, 5451, 5462, 5499], "groceries"],
	[[5811, 5812, 5813, 5814], "food"],
	[
		[
			4011, 4111, 4112, 4121, 4131, 4511, 4784, 4789, 5172, 5541, 5542, 7512,
			7523, 7531, 7538, 7542,
		],
		"transport",
	],
	[[7011, 7012, 7032, 7033], "lodging"],
	[[4722, 4723], "travel"],
	[
		[
			5310, 5311, 5331, 5399, 5611, 5621, 5631, 5641, 5651, 5655, 5661, 5691,
			5699, 5732, 5941, 5945, 5947, 5948, 5977, 5999,
		],
		"shopping",
	],
	[[5200, 5211, 5231, 5251, 5261, 5712, 5713, 5714, 5719, 5722], "home"],
	[
		[
			5122, 5912, 8011, 8021, 8031, 8041, 8042, 8043, 8049, 8050, 8062, 8071,
			8099,
		],
		"health",
	],
	[[742, 5995], "pets"],
	[[4814, 4816, 4899, 5815, 5816, 5817, 5818, 5968], "subscriptions"],
	[[4900, 6300], "bills"],
	[[7230, 7297, 7298], "care"],
	[[8211, 8220, 8241, 8244, 8249, 8299], "education"],
	[[5733, 5735, 5942, 5994, 7829, 8911], "culture"],
	[
		[
			7832, 7841, 7922, 7929, 7932, 7933, 7941, 7991, 7992, 7996, 7997, 7998,
			7999,
		],
		"activities",
	],
	[[9211, 9222, 9311], "taxes"],
	[[6010, 6011, 6012, 6051, 6211], "finance"],
];

/** Turns linked banks' lines into personal expenses, and moves a link onto a new consent without doubling them. */
class BankSync {
	readonly offMessage = "Bank sync is turned off on this server.";

	/** Whether an admin left bank sync on for this server. */
	enabled(): boolean {
		return getSetting("bankSyncEnabled");
	}

	/** How `userId`'s ledger files a description: like they filed the same one before, else by keywords and their own categories. */
	personalGuess(userId: string): (description: string) => string | undefined {
		const history = PersonalExpenseDTO.categoryHistory(userId);
		const custom = PersonalCategoryDTO.forUser(userId).map((entry) =>
			entry.toJSON(),
		);
		return (description) =>
			history.get(similarKey(description)) ??
			guessCategory(description, custom);
	}

	/**
	 * A booked line of bank account `accountUid` as a personal entry: money out filed by `guess`, money in as income, and
	 * either flagged and filed under Finance when it moves money to or from savings; `undefined` for pending lines.
	 */
	bankExpense(
		accountUid: string,
		transaction: Transaction,
		guess: (description: string) => string | undefined = guessCategory,
	): BankExpense | undefined {
		const bookedOn =
			transaction.booking_date ??
			transaction.value_date ??
			transaction.transaction_date;
		const { amount, currency } = transaction.transaction_amount;
		const amountMinor = Math.round(
			Math.abs(Number(amount)) * 10 ** currencyDigits(currency),
		);
		if (
			(transaction.status && transaction.status !== "BOOK") ||
			!bookedOn ||
			!Number.isFinite(amountMinor) ||
			amountMinor === 0
		) {
			return undefined;
		}
		const income = transaction.credit_debit_indicator === "CRDT";
		const { description, firstLine } = this.#describe(transaction, income);
		const aside = isMoneyAside(description);
		const reference =
			transaction.transaction_id ??
			transaction.entry_reference ??
			`${bookedOn}:${amount}:${firstLine}`;
		const fallback = aside ? "finance" : "other";
		return {
			description,
			category: income
				? aside
					? "finance"
					: "income"
				: (guess(description) ??
					this.#merchantCategory(transaction.merchant_category_code) ??
					fallback),
			kind: income ? "income" : "expense",
			aside,
			amountMinor,
			currency,
			spentOn: (
				transaction.transaction_date ??
				this.#cardDate(firstLine, bookedOn.slice(0, 10)) ??
				bookedOn
			).slice(0, 10),
			bankRef: `${accountUid}:${reference}`,
			bankAccountUid: accountUid,
		};
	}

	/** Asks the worker to sync `connection` and shows it as waiting meanwhile. */
	queue(connection: BankConnectionDTO): void {
		connection.markQueued();
		JobDTO.enqueue(
			"bank.sync",
			{ connectionId: connection.id },
			{ maxAttempts: 1 },
		);
	}

	/**
	 * Fetches every account of linked bank `connection` with its owner's keys, since its last sync or, first after a
	 * consent, as far back as the bank allows; records the new lines and keeps the link's state and logo current.
	 * Returns how many are new.
	 *
	 * @throws When the bank refuses, the link expired or anything else breaks; the link records why, in words for people.
	 */
	async sync(connection: BankConnectionDTO): Promise<number> {
		connection.markRunning();
		try {
			if (connection.expired()) {
				throw new BankError("The bank link expired. Connect the bank again.");
			}
			const credentials = bankCredentialsFor(connection.userId);
			if (!credentials) {
				throw new BankError(
					"Bank sync is off for this account. Set it up again in your account.",
				);
			}
			const client = new EnableBankingClient(credentials);
			if (!connection.toJSON().bankLogo) {
				const logo = await client
					.bankLogo(connection.bankName, connection.toJSON().bankCountry)
					.catch(() => undefined);
				if (logo) {
					connection.setLogo(logo);
				}
			}
			if (connection.accounts.length === 0) {
				throw new BankError(noReadableAccount);
			}
			const from = connection.fetchFrom();
			const guess = this.personalGuess(connection.userId);
			const report: BankSyncReport[] = [];
			const balances = new Map<string, { minor: number; currency: string }>();
			for (const account of connection.accounts) {
				if (account.savings === undefined) {
					connection.setAccountFlags(account.uid, {
						savings: isMoneyAside(account.name),
					});
				}
				const transactions = await client.transactions(account.uid, from);
				const balance = await client
					.balance(account.uid)
					.catch(() => undefined);
				if (balance) {
					balances.set(account.uid, balance);
				}
				const expenses = transactions
					.map((transaction) =>
						this.bankExpense(account.uid, transaction, guess),
					)
					.filter((entry) => entry !== undefined);
				PersonalExpenseDTO.refreshUncategorized(connection.userId, expenses);
				report.push({
					accountUid: account.uid,
					fetched: transactions.length,
					booked: expenses.length,
					added: PersonalExpenseDTO.importFromBank(
						connection.userId,
						connection.id,
						expenses,
					),
				});
			}
			const added = report.reduce((total, entry) => total + entry.added, 0);
			connection.setBalances(balances);
			this.pairTransfers(connection.userId);
			connection.markSynced(added, report);
			return added;
		} catch (error) {
			connection.markFailed(
				error instanceof BankError
					? error.message
					: "The sync failed on our side. Try again in a while.",
			);
			throw error;
		}
	}

	/**
	 * Moves `connection` onto the new consent `link`. The bank gives each account a new uid per consent, so the lines of
	 * an account it lists again follow it to its new uid, and the full sync that follows adds nothing twice. Accounts
	 * saved without their hash get it from the old session while it can still be read.
	 */
	async relink(
		connection: BankConnectionDTO,
		link: BankLink,
		credentials: BankCredentials,
	): Promise<void> {
		const hashes = connection.accounts.every(
			(account) => account.identificationHash,
		)
			? new Map<string, string>()
			: await new EnableBankingClient(credentials).sessionAccountHashes(
					connection.sessionId,
				);
		const previousAccounts = connection.accounts.map((account) => ({
			...account,
			identificationHash: account.identificationHash ?? hashes.get(account.uid),
		}));
		const accounts = link.accounts.map((account) => {
			const previous = previousAccounts.find((candidate) =>
				this.#sameAccount(candidate, account, previousAccounts),
			);
			if (previous && previous.uid !== account.uid) {
				PersonalExpenseDTO.moveBankAccount(
					connection.userId,
					previous.uid,
					account.uid,
				);
			}
			return previous
				? {
						...account,
						...(previous.originalName && {
							name: previous.name,
							originalName: account.name,
						}),
						shared: previous.shared,
						savings: previous.savings ?? account.savings,
						balance: previous.balance,
					}
				: account;
		});
		connection.replaceSession({ ...link, accounts });
	}

	/**
	 * Pairs money leaving one of `userId`'s accounts with the same amount reaching another within three days, then
	 * files every pair: set aside when it went into savings, an internal transfer otherwise. A line the person filed
	 * elsewhere since stays as they left it. Returns how many pairs are new.
	 */
	pairTransfers(userId: string): number {
		const accounts = new Map(
			BankConnectionDTO.accountsOf(userId).map((account) => [
				account.uid,
				account,
			]),
		);
		const lines: (TransferLine & { fresh?: boolean })[] =
			PersonalExpenseDTO.transferLines(userId).filter((line) =>
				accounts.has(line.bankAccountUid),
			);
		const paired = this.#pair(lines);
		const byId = new Map(lines.map((line) => [line.id, line]));
		for (const line of lines) {
			const other = line.transferPairId
				? byId.get(line.transferPairId)
				: undefined;
			if (
				!other ||
				(line.category !== internalCategory && line.category !== "finance")
			) {
				continue;
			}
			const [out, into] =
				line.kind === "expense" ? [line, other] : [other, line];
			const aside =
				line === out &&
				Boolean(accounts.get(into.bankAccountUid)?.savings) &&
				!accounts.get(out.bankAccountUid)?.savings;
			const category = aside ? "finance" : internalCategory;
			if (category !== line.category || aside !== line.aside || line.fresh) {
				PersonalExpenseDTO.fileTransfer(userId, [line.id], {
					category,
					aside,
					transferPairId: other.id,
				});
			}
		}
		return paired;
	}

	/** Links each unpaired line leaving an account to the closest unpaired line of the same amount reaching another. */
	#pair(lines: (TransferLine & { fresh?: boolean })[]): number {
		const incoming = Map.groupBy(
			lines.filter((line) => line.kind === "income" && !line.transferPairId),
			(line) => `${line.currency}:${line.amountMinor}`,
		);
		const dayMs = 24 * 60 * 60 * 1000;
		const gap = (left: string, right: string) =>
			Math.abs(Date.parse(left) - Date.parse(right)) / dayMs;
		let paired = 0;
		for (const out of lines) {
			if (out.kind !== "expense" || out.transferPairId) {
				continue;
			}
			const into = (incoming.get(`${out.currency}:${out.amountMinor}`) ?? [])
				.filter(
					(candidate) =>
						!candidate.transferPairId &&
						candidate.bankAccountUid !== out.bankAccountUid &&
						gap(candidate.spentOn, out.spentOn) <= 3,
				)
				.toSorted(
					(left, right) =>
						gap(left.spentOn, out.spentOn) - gap(right.spentOn, out.spentOn),
				)[0];
			if (into) {
				for (const [line, other] of [
					[out, into],
					[into, out],
				] as const) {
					Object.assign(line, {
						transferPairId: other.id,
						category: internalCategory,
						fresh: true,
					});
				}
				paired += 1;
			}
		}
		return paired;
	}

	/**
	 * What a line is called: the other party's name, else its remittance text, where a card line's generic first line
	 * ("PAIEMENT CB 2310 PARIS…") gives way to the merchant on the lines after it. `firstLine` is the name this used
	 * to get, kept in references so a line already saved isn't saved twice.
	 */
	#describe(
		transaction: Transaction,
		income: boolean,
	): { description: string; firstLine: string } {
		const party = (
			income ? transaction.debtor : transaction.creditor
		)?.name?.trim();
		const lines = (transaction.remittance_information ?? [])
			.map((line) => line.trim())
			.filter(Boolean);
		const firstLine = (
			party ||
			lines[0] ||
			(income ? "Money in" : "Card payment")
		).slice(0, 120);
		const merchant =
			!party && lines[0] && cardLine.test(lines[0])
				? lines.slice(1).join(" ")
				: "";
		return {
			description: (merchant.replaceAll(/\s+/g, " ") || firstLine).slice(
				0,
				120,
			),
			firstLine,
		};
	}

	/** The day a card line says it was paid ("PAIEMENT CB 2310" is the 23rd of October), the year taken from `bookedOn`. */
	#cardDate(line: string, bookedOn: string): string | undefined {
		const match = cardLine.exec(line);
		if (!match) {
			return undefined;
		}
		const [day, month] = [Number(match[1]), Number(match[2])];
		if (month < 1 || month > 12 || day < 1 || day > 31) {
			return undefined;
		}
		const booked = Number(bookedOn.slice(0, 4));
		const candidate = `${booked}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		return candidate > bookedOn
			? `${booked - 1}${candidate.slice(4)}`
			: candidate;
	}

	/** The category a card's merchant code (ISO 18245) points to, if it's a known one. */
	#merchantCategory(code: string | undefined): string | undefined {
		const value = Number(code);
		if (!code || !Number.isInteger(value)) {
			return undefined;
		}
		if (value >= 3000 && value <= 3299) {
			return "transport";
		}
		if (value >= 3351 && value <= 3441) {
			return "transport";
		}
		if (value >= 3501 && value <= 3999) {
			return "lodging";
		}
		return merchantCategories.find(([codes]) => codes.includes(value))?.[1];
	}

	/** Whether `next` is the same account as `previous`: by hash when both have one, else by a unique name and currency. */
	#sameAccount(
		previous: BankConnectionDTO["accounts"][number],
		next: BankLink["accounts"][number],
		previousAccounts: BankConnectionDTO["accounts"],
	): boolean {
		if (previous.identificationHash && next.identificationHash) {
			return previous.identificationHash === next.identificationHash;
		}
		const bankName = (account: BankConnectionDTO["accounts"][number]) =>
			account.originalName ?? account.name;
		return (
			bankName(previous) === next.name &&
			previous.currency === next.currency &&
			previousAccounts.filter(
				(account) =>
					bankName(account) === next.name && account.currency === next.currency,
			).length === 1
		);
	}
}

export const bankSync = new BankSync();
