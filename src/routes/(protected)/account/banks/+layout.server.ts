import { error } from "@sveltejs/kit";

import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	if (!bankSync.enabled()) {
		error(404, bankSync.offMessage);
	}
	return {
		applicationId: bankCredentialsFor(user.id)?.applicationId ?? null,
	};
};
