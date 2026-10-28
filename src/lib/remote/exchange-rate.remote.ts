import { query } from "$app/server";
import { z } from "zod";

import { currencies } from "#lib/currencies.js";
import { access } from "#lib/server/auth/access.js";
import { exchangeRates } from "#lib/server/expenses/exchange-rates.js";

export const getExchangeRate = query(
	z.object({
		from: z.enum(currencies),
		to: z.enum(currencies),
		date: z.iso.date(),
	}),
	async ({ from, to, date }) => {
		access.requireUser();
		return (await exchangeRates.rate(from, to, date)) ?? null;
	},
);
