import { z } from "zod";

import { currencies } from "#lib/currencies.js";
import type { ExpenseInput } from "#lib/dto/expense.js";
import { convertMinor, parseMoney } from "#lib/money.js";
import { recurrenceFrequencies, splitModes } from "#lib/server/db/schema.js";
import type { FieldErrors, ParsedForm } from "#lib/server/validation/form.js";
import { splitByWeight } from "#lib/split.js";

const baseSchema = z.object({
	description: z
		.string()
		.trim()
		.min(1, "Say what it was for.")
		.max(120, "Keep it under 120 characters."),
	category: z.string().default("other"),
	amount: z.string(),
	currency: z.enum(currencies).optional(),
	exchangeRate: z.string().default(""),
	paidBy: z.string().min(1, "Pick who paid."),
	spentOn: z.iso.date("Pick a date."),
	splitMode: z.enum(splitModes).default("equal"),
	merchant: z
		.string()
		.trim()
		.max(80, "Keep the merchant under 80 characters.")
		.default(""),
	repeat: z.enum(["never", ...recurrenceFrequencies]).default("never"),
});

/** The expense form once valid: the expense, the merchant typed or picked, and how often it repeats. */
export type ExpenseForm = Omit<ExpenseInput, "merchantId"> & {
	merchant: string | undefined;
	repeat: (typeof recurrenceFrequencies)[number] | undefined;
};

interface ExpenseContext {
	currency: string;
	memberIds: string[];
	categories: string[];
}

function fail(field: string, message: string): ParsedForm<ExpenseForm> {
	return {
		success: false,
		errors: { [field]: [message] } satisfies FieldErrors,
	};
}

/**
 * Each participant's exact amount (`exact:<memberId>`), typed in `currency`, converted to the group's with `toGroup`;
 * the rounding left over goes to the first one so they add up to `amountMinor`. A message when they don't add up.
 */
function exactShares(
	formData: FormData,
	participants: string[],
	{
		currency,
		originalMinor,
		amountMinor,
		toGroup,
	}: {
		currency: string;
		originalMinor: number;
		amountMinor: number;
		toGroup: (minor: number) => number;
	},
): ExpenseInput["shares"] | string {
	const amounts = participants.map((memberId) => ({
		memberId,
		amountMinor: parseMoney(
			String(formData.get(`exact:${memberId}`) ?? "0"),
			currency,
		),
	}));
	if (amounts.some((entry) => entry.amountMinor === undefined)) {
		return "Each amount must be a number.";
	}
	const sum = amounts.reduce(
		(total, entry) => total + (entry.amountMinor ?? 0),
		0,
	);
	if (sum !== originalMinor) {
		return "The amounts must add up to the total.";
	}
	const shares = amounts.map((entry) => ({
		memberId: entry.memberId,
		amountMinor: toGroup(entry.amountMinor ?? 0),
		weight: 1,
	}));
	const [first] = shares;
	if (first) {
		first.amountMinor +=
			amountMinor -
			shares.reduce((total, share) => total + share.amountMinor, 0);
	}
	return shares;
}

/**
 * Validates the add or edit expense form against the group's currency and members, and computes each member's share:
 * equal parts, weights (`weight:<memberId>`) or exact amounts (`exact:<memberId>`) that must add up to the total.
 * Amounts typed in another `currency` are converted at `exchangeRate` and the original kept. `merchant` and `repeat`
 * are optional.
 */
export function parseExpenseForm(
	formData: FormData,
	{ currency, memberIds, categories }: ExpenseContext,
): ParsedForm<ExpenseForm> {
	const base = baseSchema.safeParse(Object.fromEntries(formData));
	if (!base.success) {
		const errors: FieldErrors = {};
		for (const issue of base.error.issues) {
			const field = String(issue.path[0] ?? "form");
			errors[field] = [...(errors[field] ?? []), issue.message];
		}
		return { success: false, errors };
	}
	const {
		amount,
		merchant,
		repeat,
		currency: entered,
		exchangeRate,
		...fields
	} = base.data;
	const expenseCurrency = entered ?? currency;
	const foreign = expenseCurrency !== currency;
	const rate = foreign ? Number(exchangeRate.trim().replace(",", ".")) : 1;
	if (!Number.isFinite(rate) || rate <= 0) {
		return fail("exchangeRate", "Enter the exchange rate.");
	}
	const toGroup = (minor: number) =>
		foreign ? convertMinor(minor, expenseCurrency, currency, rate) : minor;
	const originalMinor = parseMoney(amount, expenseCurrency);
	if (!originalMinor) {
		return fail("amount", "Enter an amount above zero.");
	}
	const amountMinor = toGroup(originalMinor);
	if (amountMinor <= 0) {
		return fail("amount", `That's less than the smallest ${currency} amount.`);
	}
	if (!categories.includes(fields.category)) {
		return fail("category", "Pick a category.");
	}
	if (!memberIds.includes(fields.paidBy)) {
		return fail("paidBy", "Pick who paid.");
	}
	const participants = formData
		.getAll("participants")
		.map(String)
		.filter((memberId) => memberIds.includes(memberId));
	if (participants.length === 0) {
		return fail("participants", "Pick at least one person to split with.");
	}

	let shares: ExpenseInput["shares"];
	if (fields.splitMode === "exact") {
		const exact = exactShares(formData, participants, {
			currency: expenseCurrency,
			originalMinor,
			amountMinor,
			toGroup,
		});
		if (typeof exact === "string") {
			return fail("participants", exact);
		}
		shares = exact;
	} else {
		const weights = participants.map((memberId) => ({
			memberId,
			weight:
				fields.splitMode === "shares"
					? Math.max(
							0,
							Math.floor(Number(formData.get(`weight:${memberId}`) ?? 1)),
						)
					: 1,
		}));
		if (weights.every((entry) => entry.weight === 0)) {
			return fail("participants", "Give at least one person a share.");
		}
		const parts = splitByWeight(amountMinor, weights);
		shares = weights
			.filter((entry) => entry.weight > 0)
			.map((entry) => ({
				memberId: entry.memberId,
				amountMinor: parts.get(entry.memberId) ?? 0,
				weight: entry.weight,
			}));
	}

	return {
		success: true,
		data: {
			...fields,
			kind: "expense",
			amountMinor,
			...(foreign && {
				originalCurrency: expenseCurrency,
				originalAmountMinor: originalMinor,
				exchangeRate: rate,
			}),
			shares,
			merchant: merchant || undefined,
			repeat: repeat === "never" ? undefined : repeat,
		},
	};
}
