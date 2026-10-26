import { query } from "$app/server";
import { error } from "@sveltejs/kit";
import { z } from "zod";

import {
	BankError,
	isBankSyncConfigured,
	listBanks,
} from "#lib/server/enable-banking.js";
import { requireUser } from "#lib/server/remote-auth.js";

export const getBanks = query(
	z.string().regex(/^[A-Z]{2}$/),
	async (country) => {
		requireUser();
		if (!isBankSyncConfigured()) {
			error(404, "Bank sync isn't set up on this server.");
		}
		try {
			return await listBanks(country);
		} catch (caught) {
			if (caught instanceof BankError) {
				error(502, caught.message);
			}
			throw caught;
		}
	},
);
