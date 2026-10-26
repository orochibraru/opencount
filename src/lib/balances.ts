export interface LedgerEntry {
	paidBy: string;
	amountMinor: number;
	shares: { memberId: string; amountMinor: number }[];
}

export interface Transfer {
	from: string;
	to: string;
	amountMinor: number;
}

/** Each member's balance in minor units: what they paid minus their share. Positive means they're owed money. */
export function computeBalances(
	memberIds: string[],
	entries: LedgerEntry[],
): Map<string, number> {
	const balances = new Map(memberIds.map((memberId) => [memberId, 0]));
	for (const entry of entries) {
		balances.set(
			entry.paidBy,
			(balances.get(entry.paidBy) ?? 0) + entry.amountMinor,
		);
		for (const share of entry.shares) {
			balances.set(
				share.memberId,
				(balances.get(share.memberId) ?? 0) - share.amountMinor,
			);
		}
	}
	return balances;
}

/** A short list of payments that brings every balance to zero: the biggest debtor pays the biggest creditor, repeatedly. */
export function settleUp(balances: Map<string, number>): Transfer[] {
	const debtors = [...balances]
		.filter(([, amount]) => amount < 0)
		.map(([id, amount]) => ({ id, amount: -amount }));
	const creditors = [...balances]
		.filter(([, amount]) => amount > 0)
		.map(([id, amount]) => ({ id, amount }));
	const transfers: Transfer[] = [];
	debtors.sort((left, right) => right.amount - left.amount);
	creditors.sort((left, right) => right.amount - left.amount);
	let debtorIndex = 0;
	let creditorIndex = 0;
	while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
		const debtor = debtors[debtorIndex];
		const creditor = creditors[creditorIndex];
		if (!debtor || !creditor) {
			break;
		}
		const amountMinor = Math.min(debtor.amount, creditor.amount);
		transfers.push({ from: debtor.id, to: creditor.id, amountMinor });
		debtor.amount -= amountMinor;
		creditor.amount -= amountMinor;
		if (debtor.amount === 0) {
			debtorIndex += 1;
		}
		if (creditor.amount === 0) {
			creditorIndex += 1;
		}
	}
	return transfers;
}
