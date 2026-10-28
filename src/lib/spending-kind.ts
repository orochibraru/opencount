export type SpendingKind = "spent" | "finance" | "aside" | "income";

/**
 * Where a personal line counts: everyday spending, Finance (loans, bank fees, cash: money out that isn't consumption
 * nor saved), set aside, or income; `undefined` for money coming back from savings, which is none of them.
 */
export function spendingKind(row: {
	kind: "expense" | "income";
	aside: boolean;
	category: string;
}): SpendingKind | undefined {
	if (row.kind === "income") {
		return row.aside ? undefined : "income";
	}
	if (row.aside) {
		return "aside";
	}
	return row.category === "finance" ? "finance" : "spent";
}
