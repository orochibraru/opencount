import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import {
	type BankExpense,
	PersonalExpenseDTO,
} from "#lib/dto/personal-expense.js";
import { currencyDigits } from "#lib/money.js";
import {
	type BankTransaction,
	bankTransactions,
} from "#lib/server/enable-banking.js";
import { guessCategory } from "#lib/smart-category.js";

/** A booked card payment or debit as a personal expense; `undefined` for money in, pending lines and refunds. */
export function bankExpense(
	accountUid: string,
	transaction: BankTransaction,
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
		transaction.credit_debit_indicator !== "DBIT" ||
		(transaction.status && transaction.status !== "BOOK") ||
		!spentOn ||
		!Number.isFinite(amountMinor) ||
		amountMinor === 0
	) {
		return undefined;
	}
	const description = (
		transaction.creditor?.name?.trim() ||
		transaction.remittance_information?.find((line) => line.trim())?.trim() ||
		"Card payment"
	).slice(0, 120);
	const reference =
		transaction.transaction_id ??
		transaction.entry_reference ??
		`${spentOn}:${amount}:${description}`;
	return {
		description,
		category: guessCategory(description) ?? "other",
		amountMinor,
		currency,
		spentOn: spentOn.slice(0, 10),
		bankRef: `${accountUid}:${reference}`,
	};
}

/**
 * Fetches every account of linked bank `connection` since its last sync and records the new spending as personal
 * expenses; returns how many are new.
 *
 * @throws When the bank refuses or the link expired; the link records why.
 */
export async function syncBank(connection: BankConnectionDTO): Promise<number> {
	try {
		if (connection.expired()) {
			throw new Error("The bank link expired. Connect the bank again.");
		}
		let added = 0;
		const from = connection.fetchFrom();
		for (const account of connection.accounts) {
			const expenses = (await bankTransactions(account.uid, from))
				.map((transaction) => bankExpense(account.uid, transaction))
				.filter((entry) => entry !== undefined);
			added += PersonalExpenseDTO.importFromBank(
				connection.userId,
				connection.id,
				expenses,
			);
		}
		connection.markSynced();
		return added;
	} catch (error) {
		connection.markFailed(
			error instanceof Error ? error.message : String(error),
		);
		throw error;
	}
}
