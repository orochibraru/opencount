export const cardRoles = ["deferred", "statement"] as const;

export type CardRole = (typeof cardRoles)[number];

const statementPattern =
	/^(relev[eé]s?\s+(de\s+)?cartes?|(facture|d[eé]bit)\s+cartes?\s+diff[eé]r[eé]e?s?)\b/i;
const purchasePattern = /\bcarte\s+x?\d{4}$/i;

/**
 * What a bank line description says about a deferred debit card: the monthly statement that settles it ("RELEVE
 * CARTE"), a purchase made with it ("SHOP CARTE 1234"), or null for anything else.
 */
export function cardRoleOf(description: string): CardRole | null {
	const text = description.trim();
	if (statementPattern.test(text)) {
		return "statement";
	}
	return purchasePattern.test(text) ? "deferred" : null;
}
