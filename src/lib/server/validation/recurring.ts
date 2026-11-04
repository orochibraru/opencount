import { z } from "zod";

import { cadences, recurringTypes } from "#lib/recurring-schedule.js";

export const recurringSchema = z.object({
	expenseId: z.string().trim().default(""),
	seriesId: z.string().trim().default(""),
	label: z
		.string()
		.trim()
		.min(1, "Name the series.")
		.max(40, "Keep the label under 40 characters."),
	type: z.enum(recurringTypes, "Pick a type."),
	frequency: z
		.union([z.enum(cadences), z.literal("")])
		.default("")
		.transform((value) => value || null),
	remaining: z
		.string()
		.trim()
		.default("")
		.refine(
			(value) => /^\d{0,3}$/.test(value),
			"Type a whole number of payments.",
		)
		.transform((value) => (value === "" ? ("" as const) : Number(value))),
});

export const unfileRecurringSchema = z.object({
	expenseId: z.string().trim().min(1),
});

export const seriesIdSchema = z.object({
	seriesId: z.string().trim().min(1),
});
