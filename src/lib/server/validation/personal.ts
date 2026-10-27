import { z } from "zod";

import { currencies } from "#lib/currencies.js";
import type { PersonalExpenseInput } from "#lib/dto/personal-expense.js";
import { parseMoney } from "#lib/money.js";
import { type ParsedForm, parseForm } from "#lib/server/validation/form.js";

const personalSchema = z.object({
	description: z
		.string()
		.trim()
		.min(1, "Say what it was for.")
		.max(120, "Keep it under 120 characters."),
	category: z.string().min(1).default("other"),
	aside: z.stringbool().default(false),
	amount: z.string(),
	currency: z.enum(currencies, "Pick a currency."),
	spentOn: z.iso.date("Pick a date."),
	folderId: z.string().default(""),
	note: z
		.string()
		.trim()
		.max(500, "Keep the note under 500 characters.")
		.default(""),
});

/** Validates the add or edit form of a personal expense. */
export function parsePersonalForm(
	formData: FormData,
): ParsedForm<PersonalExpenseInput> {
	const parsed = parseForm(personalSchema, formData);
	if (!parsed.success) {
		return parsed;
	}
	const { amount, folderId, note, ...fields } = parsed.data;
	const amountMinor = parseMoney(amount, fields.currency);
	if (!amountMinor) {
		return {
			success: false,
			errors: { amount: ["Enter an amount above zero."] },
		};
	}
	return {
		success: true,
		data: {
			...fields,
			amountMinor,
			folderId: folderId || null,
			note: note || null,
		},
	};
}
