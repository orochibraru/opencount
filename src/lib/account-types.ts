export const accountTypes = [
	"checking",
	"joint",
	"savings",
	"investment",
	"credit_card",
] as const;

export type AccountType = (typeof accountTypes)[number];

export const accountTypeLabels: Record<AccountType, string> = {
	checking: "Everyday account",
	joint: "Joint account",
	savings: "Savings",
	investment: "Investments",
	credit_card: "Credit card",
};

export interface AccountView {
	id: string;
	connectionId: string | null;
	bankName: string | null;
	bankLogo: string | null;
	syncing: boolean;
	failed: boolean;
	name: string;
	type: AccountType;
	currency: string;
	shared: boolean;
	balance: {
		minor: number;
		currency: string;
		at: string;
		manual: boolean;
	} | null;
	syncedAt: string | null;
}

/** Whether an account of type `type` holds money set aside rather than money to spend. */
export function holdsSavings(type: AccountType): boolean {
	return type === "savings" || type === "investment";
}

/** The owner's part of `account`'s balance: half of a shared one, none without a balance. */
export function ownShare(account: AccountView): number {
	const minor = account.balance?.minor ?? 0;
	return account.shared ? Math.trunc(minor / 2) : minor;
}

export interface BalanceTotals {
	toSpendMinor: number;
	savedMinor: number;
	sharedMinor: number;
	sharedCount: number;
}

/**
 * What `accounts` in `currency` hold for their owner: to spend and saved, counting shared accounts (at half) only when
 * `withShared`, and what the shared ones hold apart either way.
 */
export function balanceTotals(
	accounts: AccountView[],
	currency: string,
	withShared: boolean,
): BalanceTotals {
	const inCurrency = accounts.filter(
		(account) => account.balance?.currency === currency,
	);
	const counted = inCurrency.filter((account) => withShared || !account.shared);
	const sum = (rows: AccountView[]) =>
		rows.reduce((total, account) => total + ownShare(account), 0);
	const shared = inCurrency.filter((account) => account.shared);
	return {
		toSpendMinor: sum(counted.filter((account) => !holdsSavings(account.type))),
		savedMinor: sum(counted.filter((account) => holdsSavings(account.type))),
		sharedMinor: sum(shared),
		sharedCount: shared.length,
	};
}
