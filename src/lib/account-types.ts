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
