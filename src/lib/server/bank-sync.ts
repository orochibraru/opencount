import type { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { JobDTO } from "#lib/dto/job.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import {
	type BankExpense,
	PersonalExpenseDTO,
} from "#lib/dto/personal-expense.js";
import { currencyDigits } from "#lib/money.js";
import {
	BankError,
	bankLogo,
	type BankTransaction,
	bankTransactions,
} from "#lib/server/enable-banking.js";
import { similarKey } from "#lib/similar-key.js";
import { guessCategory, isMoneyAside } from "#lib/smart-category.js";

/** How `userId`'s ledger files a description: like they filed the same one before, else by keywords and their own categories. */
export function personalGuess(
	userId: string,
): (description: string) => string | undefined {
	const history = PersonalExpenseDTO.categoryHistory(userId);
	const custom = PersonalCategoryDTO.forUser(userId).map((entry) =>
		entry.toJSON(),
	);
	return (description) =>
		history.get(similarKey(description)) ?? guessCategory(description, custom);
}

/**
 * A booked line of bank account `accountUid` as a personal entry: money out filed by `guess`, money in as income, and
 * either flagged and filed under Finance when it moves money to or from savings; `undefined` for pending lines.
 */
export function bankExpense(
	accountUid: string,
	transaction: BankTransaction,
	guess: (description: string) => string | undefined = guessCategory,
): BankExpense | undefined {
	const spentOn =
		transaction.booking_date ??
		transaction.value_date ??
		transaction.transaction_date;
	const { amount, currency } = transaction.transaction_amount;
	const amountMinor = Math.round(
		Math.abs(Number(amount)) * 10 ** currencyDigits(currency),
	);
	if (
		(transaction.status && transaction.status !== "BOOK") ||
		!spentOn ||
		!Number.isFinite(amountMinor) ||
		amountMinor === 0
	) {
		return undefined;
	}
	const income = transaction.credit_debit_indicator === "CRDT";
	const description = (
		(income ? transaction.debtor : transaction.creditor)?.name?.trim() ||
		transaction.remittance_information?.find((line) => line.trim())?.trim() ||
		(income ? "Money in" : "Card payment")
	).slice(0, 120);
	const aside = isMoneyAside(description);
	const reference =
		transaction.transaction_id ??
		transaction.entry_reference ??
		`${spentOn}:${amount}:${description}`;
	const fallback = aside ? "finance" : "other";
	return {
		description,
		category: income
			? aside
				? "finance"
				: "income"
			: (guess(description) ?? fallback),
		kind: income ? "income" : "expense",
		aside,
		amountMinor,
		currency,
		spentOn: spentOn.slice(0, 10),
		bankRef: `${accountUid}:${reference}`,
		bankAccountUid: accountUid,
	};
}

/** Asks the worker to sync `connection`, its whole history when `full`, and shows it as waiting meanwhile. */
export function queueBankSync(
	connection: BankConnectionDTO,
	full = false,
): void {
	connection.markQueued();
	JobDTO.enqueue(
		"bank.sync",
		{ connectionId: connection.id, full },
		{ maxAttempts: 1 },
	);
}

/**
 * Fetches every account of linked bank `connection`, with its owner's Enable Banking keys, since its last sync or as
 * far back as the bank allows on the first one or when `full`, records the new lines as personal expenses, and keeps
 * the link's sync state and logo current; returns how many are new.
 *
 * @throws When the bank refuses, the link expired or anything else breaks; the link records why, in words for people.
 */
export async function syncBank(
	connection: BankConnectionDTO,
	full = false,
): Promise<number> {
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
		if (!connection.toJSON().bankLogo) {
			const logo = await bankLogo(
				credentials,
				connection.bankName,
				connection.toJSON().bankCountry,
			).catch(() => undefined);
			if (logo) {
				connection.setLogo(logo);
			}
		}
		let added = 0;
		const from = full ? undefined : connection.fetchFrom();
		const guess = personalGuess(connection.userId);
		for (const account of connection.accounts) {
			const expenses = (await bankTransactions(credentials, account.uid, from))
				.map((transaction) => bankExpense(account.uid, transaction, guess))
				.filter((entry) => entry !== undefined);
			added += PersonalExpenseDTO.importFromBank(
				connection.userId,
				connection.id,
				expenses,
			);
		}
		connection.markSynced(added);
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
