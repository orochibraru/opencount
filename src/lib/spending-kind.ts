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

export type Flow =
	| "spending"
	| "income"
	| "finance"
	| "transfer_internal"
	| "transfer_to_savings"
	| "transfer_from_savings"
	| "card_statement";

/**
 * How a personal line moves money, for people and AI apps alike: spending and income count in totals; finance counts
 * apart; transfers between the person's own accounts and card statements (their purchases already count) never do.
 */
export function flowOf(row: {
	kind: "expense" | "income";
	aside: boolean;
	category: string;
	cardRole: "deferred" | "statement" | null;
}): Flow {
	if (row.cardRole === "statement") {
		return "card_statement";
	}
	if (row.category === "internal") {
		return "transfer_internal";
	}
	if (row.aside) {
		return row.kind === "income"
			? "transfer_from_savings"
			: "transfer_to_savings";
	}
	if (row.kind === "income") {
		return "income";
	}
	return row.category === "finance" ? "finance" : "spending";
}
