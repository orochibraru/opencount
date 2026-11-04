import { z } from "zod";

const optional = z
	.string()
	.trim()
	.default("")
	.transform((value) => value || null);

export const ruleSchema = z.object({
	id: z.string().trim().default(""),
	pattern: z
		.string()
		.trim()
		.min(2, "Type at least 2 characters to look for.")
		.max(60, "Keep it under 60 characters."),
	category: optional,
	tag: z
		.string()
		.trim()
		.toLowerCase()
		.max(24, "Keep the tag under 24 characters.")
		.default("")
		.transform((value) => value || null),
	pay: z.stringbool().default(false),
	recurringId: optional,
});

export const ruleIdSchema = z.object({ id: z.string().trim().min(1) });

export const expectedPaydaySchema = z.object({
	expectedPayday: z
		.union([z.iso.date("Pick a day."), z.literal("")])
		.default("")
		.transform((value) => value || null),
	clear: z.stringbool().default(false),
});

export const ruleErrors = {
	category: { category: ["Pick a category."] },
	series: { recurringId: ["Pick one of your series."] },
	empty: { pattern: ["Pick at least one thing the rule sets."] },
	missing: { pattern: ["That rule no longer exists."] },
} as const;
