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
