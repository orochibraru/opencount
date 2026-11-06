import { type AccountType, holdsSavings } from "#lib/account-types.js";

export interface LeftAccount {
	id: string;
	name: string;
	type: AccountType;
	shared: boolean;
	ownShareMinor: number;
	balanceAt: string | null;
	includedByDefault: boolean;
}

export interface LeftParts {
	currency: string;
	today: string;
	nextPayday: string;
	daysLeft: number;
	accounts: LeftAccount[];
	upcoming: {
		label: string;
		accountId: string | null;
		minor: number;
		on: string;
	}[];
	pending: { accountId: string | null; minor: number; count: number }[];
}

export interface LeftResult {
	balancesMinor: number;
	upcomingMinor: number;
	pendingMinor: number;
	leftMinor: number;
	perDayMinor: number;
}

/** Whether an account of type `type` holds money to spend: savings and investments don't, a joint one does but starts off. */
export function spendable(type: AccountType): boolean {
	return !holdsSavings(type);
}

/**
 * What is left to spend until payday from `parts`, counting the accounts in `included`: their balances (a shared one
 * at half), minus the recurring debits due from them before payday and the deferred card purchases they have yet to
 * pay, spread over the days left. Recurring debits from no known account always count.
 */
export function leftUntilPayday(
	parts: LeftParts,
	included: ReadonlySet<string>,
): LeftResult {
	const counts = (accountId: string | null) =>
		accountId === null ||
		included.has(accountId) ||
		!parts.accounts.some((account) => account.id === accountId);
	const balancesMinor = parts.accounts
		.filter((account) => included.has(account.id))
		.reduce((total, account) => total + account.ownShareMinor, 0);
	const upcomingMinor = parts.upcoming
		.filter((entry) => counts(entry.accountId))
		.reduce((total, entry) => total + entry.minor, 0);
	const pendingMinor = parts.pending
		.filter((entry) => counts(entry.accountId))
		.reduce((total, entry) => total + entry.minor, 0);
	const leftMinor = balancesMinor - upcomingMinor - pendingMinor;
	return {
		balancesMinor,
		upcomingMinor,
		pendingMinor,
		leftMinor,
		perDayMinor: Math.trunc(leftMinor / Math.max(1, parts.daysLeft)),
	};
}

/** The ids of the accounts in `parts` counted unless someone says otherwise: everyday accounts and cards, no joint one. */
export function defaultIncluded(parts: LeftParts): Set<string> {
	return new Set(
		parts.accounts
			.filter((account) => account.includedByDefault)
			.map((account) => account.id),
	);
}
