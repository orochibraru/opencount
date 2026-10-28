import { resolve } from "$app/paths";
import { error, redirect } from "@sveltejs/kit";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import { bankCredentialsFor } from "#lib/dto/bank-credential.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import {
	BankError,
	type BankLink,
	bankLinkPurpose,
	EnableBankingClient,
} from "#lib/server/banking/enable-banking.js";
import { Logger } from "#lib/server/core/logger.js";
import { secrets } from "#lib/server/core/secrets.js";

const logger = new Logger("Banks");

export const GET = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, "Sign in again, then connect the bank again.");
	}
	if (!bankSync.enabled()) {
		error(404, bankSync.offMessage);
	}
	const linked = resolve("/(protected)/account/banks/linked");
	const code = url.searchParams.get("code");
	const state = secrets.verify(
		url.searchParams.get("state") ?? undefined,
		bankLinkPurpose,
	);
	const credentials = bankCredentialsFor(locals.user.id);
	if (!code || !credentials || state?.userId !== locals.user.id) {
		redirect(303, `${linked}?link=cancelled`);
	}
	let link: BankLink;
	try {
		link = await new EnableBankingClient(credentials).openSession(code);
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
		await new EnableBankingClient(credentials).closeSession(link.sessionId);
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
		await bankSync.relink(relinked, link, credentials);
		await new EnableBankingClient(credentials).closeSession(previousSession);
		bankSync.queue(relinked);
		redirect(303, `${linked}?link=relinked`);
	}
	bankSync.queue(BankConnectionDTO.create(locals.user.id, link));
	redirect(303, `${linked}?link=connected`);
};
