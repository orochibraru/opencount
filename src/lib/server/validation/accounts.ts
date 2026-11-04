import { z } from "zod";

import { accountTypes } from "#lib/account-types.js";

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
