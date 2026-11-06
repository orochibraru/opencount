import { error } from "@sveltejs/kit";

import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";

export const load = async ({ parent, route }) => {
	const { user } = await parent();
	const enabled = bankSync.enabled();
	if (!enabled && route.id !== "/(protected)/account/banks/accounts") {
		error(404, bankSync.offMessage);
	}
	return {
		bankSyncOn: enabled,
		applicationId: bankCredentialsFor(user.id)?.applicationId ?? null,
	};
};
