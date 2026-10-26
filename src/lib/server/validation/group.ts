import { z } from "zod";

import { currencies } from "#lib/currencies.js";

export const newGroupSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Give the group a name.")
		.max(60, "Keep it under 60 characters."),
	currency: z.enum(currencies, "Pick a currency."),
});
