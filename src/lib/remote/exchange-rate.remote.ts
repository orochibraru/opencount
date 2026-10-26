import { query } from "$app/server";
import { z } from "zod";

import { currencies } from "#lib/currencies.js";
import { exchangeRate } from "#lib/server/exchange-rates.js";
import { requireUser } from "#lib/server/remote-auth.js";

export const getExchangeRate = query(
	z.object({
		from: z.enum(currencies),
		to: z.enum(currencies),
		date: z.iso.date(),
	}),
	async ({ from, to, date }) => {
		requireUser();
		return (await exchangeRate(from, to, date)) ?? null;
	},
);
