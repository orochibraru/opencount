import { resolve } from "$app/paths";
import { error, redirect } from "@sveltejs/kit";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { queueBankSync, relinkBank } from "#lib/server/bank-sync.js";
import {
	BankError,
	type BankLink,
	bankLinkPurpose,
	closeBankSession,
	openBankSession,
} from "#lib/server/enable-banking.js";
import { Logger } from "#lib/server/logger.js";
import { verifyPayload } from "#lib/server/secrets.js";

const logger = new Logger("Banks");

export const GET = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, "Sign in again, then connect the bank again.");
	}
	const linked = resolve("/(protected)/account/banks/linked");
	const code = url.searchParams.get("code");
	const state = verifyPayload(
		url.searchParams.get("state") ?? undefined,
		bankLinkPurpose,
	);
	const credentials = bankCredentialsFor(locals.user.id);
	if (!code || !credentials || state?.userId !== locals.user.id) {
		redirect(303, `${linked}?link=cancelled`);
	}
	let link: BankLink;
	try {
		link = await openBankSession(credentials, code);
	} catch (caught) {
		if (caught instanceof BankError) {
			logger.warn("Bank link refused", { message: caught.message });
			redirect(303, `${linked}?link=failed`);
		}
		throw caught;
	}
	if (link.accounts.length === 0) {
		logger.warn("Bank link shared no readable account", {
			bank: link.bankName,
			listed: link.listedAccounts,
		});
		await closeBankSession(credentials, link.sessionId);
		redirect(
			303,
			`${linked}?link=${link.listedAccounts > 0 ? "unreadable" : "empty"}`,
		);
	}
	const relinked =
		typeof state.connectionId === "string"
			? BankConnectionDTO.findForUser(state.connectionId, locals.user.id)
			: undefined;
	if (relinked) {
		const previousSession = relinked.sessionId;
		await relinkBank(relinked, link, credentials);
		await closeBankSession(credentials, previousSession);
		queueBankSync(relinked);
		redirect(303, `${linked}?link=relinked`);
	}
	queueBankSync(BankConnectionDTO.create(locals.user.id, link));
	redirect(303, `${linked}?link=connected`);
};
