import { resolve } from "$app/paths";
import { error, redirect } from "@sveltejs/kit";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { JobDTO } from "#lib/dto/job.js";
import {
	BankError,
	bankLinkPurpose,
	openBankSession,
} from "#lib/server/enable-banking.js";
import { Logger } from "#lib/server/logger.js";
import { verifyPayload } from "#lib/server/secrets.js";

const logger = new Logger("Banks");

export const GET = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, "Sign in again, then connect the bank again.");
	}
	const personal = resolve("/(protected)/personal");
	const code = url.searchParams.get("code");
	const state = verifyPayload(
		url.searchParams.get("state") ?? undefined,
		bankLinkPurpose,
	);
	const credentials = bankCredentialsFor(locals.user.id);
	if (!code || !credentials || state?.userId !== locals.user.id) {
		redirect(303, `${personal}?bank=cancelled`);
	}
	let connectionId: string;
	try {
		const link = await openBankSession(credentials, code);
		connectionId = BankConnectionDTO.create(locals.user.id, link).id;
	} catch (caught) {
		if (caught instanceof BankError) {
			logger.warn("Bank link refused", { message: caught.message });
			redirect(303, `${personal}?bank=failed`);
		}
		throw caught;
	}
	JobDTO.enqueue("bank.sync", { connectionId }, { maxAttempts: 1 });
	redirect(303, `${personal}?bank=connected`);
};
