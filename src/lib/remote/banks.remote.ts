import { query } from "$app/server";
import { error } from "@sveltejs/kit";
import { z } from "zod";

import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { BankError, listBanks } from "#lib/server/enable-banking.js";
import { requireUser } from "#lib/server/remote-auth.js";

export const getBanks = query(
	z.string().regex(/^[A-Z]{2}$/),
	async (country) => {
		const credentials = bankCredentialsFor(requireUser().id);
		if (!credentials) {
			error(404, "Set up bank sync in your account first.");
		}
		try {
			return await listBanks(credentials, country);
		} catch (caught) {
			if (caught instanceof BankError) {
				error(502, caught.message);
			}
			throw caught;
		}
	},
);
