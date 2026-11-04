import { fail } from "@sveltejs/kit";

import { parseSignedMoney } from "#lib/money.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import { accountBook } from "#lib/server/money/accounts.js";
import {
	accountBalanceSchema,
	accountSharedSchema,
	accountTypeSchema,
} from "#lib/server/validation/accounts.js";
import { parseForm } from "#lib/server/validation/form.js";

const gone = () => fail(404, { error: "That account isn't linked anymore." });

export const load = async ({ parent }) => {
	const { user } = await parent();
	return { accounts: accountBook.list(user.id) };
};

export const actions = {
	setType: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountTypeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const connection = accountBook.connectionOf(locals.user.id, parsed.data.id);
		if (!connection?.setAccountType(parsed.data.id, parsed.data.type)) {
			return gone();
		}
		bankSync.pairTransfers(locals.user.id);
		return { saved: true };
	},
	setShared: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountSharedSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const connection = accountBook.connectionOf(locals.user.id, parsed.data.id);
		if (
			!connection?.setAccountFlags(parsed.data.id, {
				shared: parsed.data.shared,
			})
		) {
			return gone();
		}
		return { saved: true };
	},
	setBalance: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountBalanceSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const account = accountBook.find(locals.user.id, parsed.data.id);
		const connection = accountBook.connectionOf(locals.user.id, parsed.data.id);
		if (!account || !connection) {
			return gone();
		}
		const minor = parseSignedMoney(parsed.data.amount, account.currency);
		if (minor === undefined) {
			return fail(400, {
				errors: { amount: ["Type an amount, like 1250.40."] },
			});
		}
		connection.setManualBalance(
			account.id,
			minor,
			new Date(`${parsed.data.asOf}T12:00:00Z`),
		);
		return { saved: true };
	},
};
