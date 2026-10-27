import { bankCredentialsFor } from "#lib/dto/bank-credential.js";

export const load = async ({ parent }) => {
	const { user } = await parent();
	return {
		applicationId: bankCredentialsFor(user.id)?.applicationId ?? null,
	};
};
