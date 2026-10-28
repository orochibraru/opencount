import { query } from "$app/server";
import { error } from "@sveltejs/kit";
import { z } from "zod";

import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { access } from "#lib/server/auth/access.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import {
	BankError,
	EnableBankingClient,
} from "#lib/server/banking/enable-banking.js";

export const getBanks = query(
	z.string().regex(/^[A-Z]{2}$/),
	async (country) => {
		const credentials = bankCredentialsFor(access.requireUser().id);
		if (!bankSync.enabled()) {
			error(404, bankSync.offMessage);
		}
		if (!credentials) {
			error(404, "Set up bank sync in your account first.");
		}
		try {
			return await new EnableBankingClient(credentials).listBanks(country);
		} catch (caught) {
			if (caught instanceof BankError) {
				error(502, caught.message);
			}
			throw caught;
		}
	},
);
