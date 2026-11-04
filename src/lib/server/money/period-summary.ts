import { categoryLabels } from "#lib/category-labels.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import {
	defaultIncluded,
	type LeftParts,
	type LeftResult,
	leftUntilPayday,
	spendable,
} from "#lib/left-until-payday.js";
import { nextAfter } from "#lib/recurring-schedule.js";
import { accountBook } from "#lib/server/money/accounts.js";
import { recurringBook } from "#lib/server/money/recurring.js";
import { spendingKind } from "#lib/spending-kind.js";

export interface Total {
	key: string;
	label: string;
	minor: number;
}

export interface Summary {
	from: string;
	to: string;
	currency: string;
	followsPay: boolean;
	incomeMinor: number;
	spentMinor: number;
	financeMinor: number;
	savedMinor: number;
	byCategory: Total[];
	byAccount: Total[];
	left: LeftParts;
	leftNow: LeftResult;
	included: string[];
}

function addDays(day: string, days: number): string {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function daysApart(from: string, to: string): number {
	return Math.round(
		(new Date(`${to}T00:00:00Z`).getTime() -
			new Date(`${from}T00:00:00Z`).getTime()) /
			86_400_000,
	);
}

function ranked(totals: Map<string, number>, label: (key: string) => string) {
	return [...totals]
		.map(([key, minor]) => ({ key, label: label(key), minor }))
		.toSorted((left, right) => right.minor - left.minor);
}

/** One answer to "where does my money stand", shared by the app and AI apps so both give the same numbers. */
class PeriodSummary {
	/**
	 * `userId`'s money from `from` to `to` (both included, YYYY-MM-DD), by default since the start of their month (their
	 * last payday when months follow pay) until `today`, in their main currency: income, spending by category and by
	 * account, finance and savings apart, transfers and card statements never; and what is left until the next payday
	 * across the accounts in `accounts` (default: everyday accounts and cards, no joint, no savings).
	 */
	summarize(
		userId: string,
		{
			from,
			to,
			accounts,
			today = new Date().toISOString().slice(0, 10),
		}: { from?: string; to?: string; accounts?: string[]; today?: string } = {},
	): Summary {
		const calendar = PersonalExpenseDTO.monthCalendar(userId);
		const monthStart = calendar.startOf(today);
		const start = from ?? monthStart;
		const end = to ?? today;
		const rows = PersonalExpenseDTO.spending(userId);
		const currency = this.#mainCurrency(rows);
		const known = accountBook.list(userId);
		const inPeriod = rows.filter(
			(row) =>
				row.currency === currency && row.spentOn >= start && row.spentOn <= end,
		);
		const byCategory = new Map<string, number>();
		const byAccount = new Map<string, number>();
		let incomeMinor = 0;
		let spentMinor = 0;
		let financeMinor = 0;
		let savedMinor = 0;
		for (const row of inPeriod) {
			const kind = spendingKind(row);
			if (kind === "income") {
				incomeMinor += row.amountMinor;
			} else if (kind === "finance") {
				financeMinor += row.amountMinor;
			} else if (kind === "aside") {
				savedMinor += row.amountMinor;
			} else if (kind === "spent") {
				spentMinor += row.amountMinor;
				byCategory.set(
					row.category,
					(byCategory.get(row.category) ?? 0) + row.amountMinor,
				);
				const account = row.bankAccountUid ?? "";
				byAccount.set(account, (byAccount.get(account) ?? 0) + row.amountMinor);
			}
		}
		const custom = new Map(
			PersonalCategoryDTO.forUser(userId).map((entry) => {
				const { id, name } = entry.toJSON();
				return [id, name];
			}),
		);
		const left = this.#leftParts(
			userId,
			currency,
			today,
			calendar.next(monthStart),
			known,
		);
		const included = accounts
			? new Set(
					accounts.filter((id) => known.some((account) => account.id === id)),
				)
			: defaultIncluded(left);
		return {
			from: start,
			to: end,
			currency,
			followsPay: calendar.followsPay,
			incomeMinor,
			spentMinor,
			financeMinor,
			savedMinor,
			byCategory: ranked(
				byCategory,
				(key) =>
					custom.get(key) ??
					categoryLabels[key as keyof typeof categoryLabels] ??
					key,
			),
			byAccount: ranked(
				byAccount,
				(key) =>
					known.find((account) => account.id === key)?.name ??
					"Typed in by hand",
			),
			left,
			leftNow: leftUntilPayday(left, included),
			included: [...included],
		};
	}

	/**
	 * What deciding the money left until `nextPayday` takes for `userId` in `currency`: each account's own share of its
	 * balance, the recurring debits due from today until the day before payday, and the deferred card purchases not yet
	 * taken from their account.
	 */
	#leftParts(
		userId: string,
		currency: string,
		today: string,
		nextPayday: string,
		known: ReturnType<typeof accountBook.list>,
	): LeftParts {
		const lastDay = addDays(nextPayday, -1);
		const upcoming = recurringBook
			.list(userId, today)
			.filter(
				(payment) =>
					payment.kind === "expense" &&
					payment.currency === currency &&
					payment.nextOn !== null,
			)
			.flatMap((payment) => {
				const dates: string[] = [];
				for (
					let day = payment.nextOn;
					day && day <= lastDay && dates.length < 60;
					day = nextAfter(day, payment.cadence, payment.everyDays)
				) {
					if (!payment.endDate || day <= payment.endDate) {
						dates.push(day);
					}
				}
				return dates.map((on) => ({
					label: payment.label,
					accountId: payment.accountUid,
					minor: payment.amountMinor,
					on,
				}));
			})
			.toSorted((left, right) => left.on.localeCompare(right.on));
		return {
			currency,
			today,
			nextPayday,
			daysLeft: Math.max(1, daysApart(today, nextPayday)),
			accounts: known
				.filter((account) => account.currency === currency)
				.map((account) => ({
					id: account.id,
					name: account.name,
					type: account.type,
					shared: account.shared,
					ownShareMinor: accountBook.share(account),
					balanceAt: account.balance?.at ?? null,
					includedByDefault:
						spendable(account.type) &&
						account.type !== "joint" &&
						!account.shared &&
						account.balance !== null,
				})),
			upcoming,
			pending: PersonalExpenseDTO.pendingDeferred(userId)
				.filter((entry) => entry.currency === currency)
				.map(({ accountUid, minor, count }) => ({
					accountId: accountUid,
					minor,
					count,
				})),
		};
	}

	/** The currency most of `rows` are in, EUR without any. */
	#mainCurrency(rows: { currency: string; amountMinor: number }[]): string {
		const totals = new Map<string, number>();
		for (const row of rows) {
			totals.set(
				row.currency,
				(totals.get(row.currency) ?? 0) + Math.abs(row.amountMinor),
			);
		}
		return (
			[...totals].toSorted((left, right) => right[1] - left[1])[0]?.[0] ?? "EUR"
		);
	}
}

export const periodSummary = new PeriodSummary();
