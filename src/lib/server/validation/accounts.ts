import { z } from "zod";

import { accountTypes } from "#lib/account-types.js";
import { currencies } from "#lib/currencies.js";

export const accountTypeSchema = z.object({
	id: z.string().trim().min(1),
	type: z.enum(accountTypes, "Pick a type."),
});

export const accountSharedSchema = z.object({
	id: z.string().trim().min(1),
	shared: z.stringbool(),
});

export const accountBalanceSchema = z.object({
	id: z.string().trim().min(1),
	amount: z.string().trim().min(1, "Type the balance."),
	asOf: z.iso.date("Pick a day."),
});

export const accountIdSchema = z.object({ id: z.string().trim().min(1) });

export const newAccountSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name the account.")
		.max(60, "Keep the name under 60 characters."),
	type: z.enum(accountTypes, "Pick a type."),
	currency: z.enum(currencies, "Pick a currency."),
	amount: z.string().trim().min(1, "Type the balance."),
	asOf: z.iso.date("Pick a day."),
});
