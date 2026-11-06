import { fail } from "@sveltejs/kit";

import { parseSignedMoney } from "#lib/money.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import { accountBook } from "#lib/server/money/accounts.js";
import {
	accountBalanceSchema,
	accountIdSchema,
	accountRenameSchema,
	accountSharedSchema,
	accountTypeSchema,
	newAccountSchema,
} from "#lib/server/validation/accounts.js";
import { parseForm } from "#lib/server/validation/form.js";

const gone = () => fail(404, { error: "That account no longer exists." });
const badAmount = () =>
	fail(400, { errors: { amount: ["Type an amount, like 1250.40."] } });

export const load = async ({ parent }) => {
	const { user } = await parent();
	return { accounts: accountBook.list(user.id) };
};

export const actions = {
	add: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(newAccountSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const minor = parseSignedMoney(parsed.data.amount, parsed.data.currency);
		if (minor === undefined) {
			return badAmount();
		}
		accountBook.add(locals.user.id, {
			name: parsed.data.name,
			type: parsed.data.type,
			currency: parsed.data.currency,
			shared: false,
			minor,
			at: new Date(`${parsed.data.asOf}T12:00:00Z`),
		});
		return { added: true };
	},
	remove: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountIdSchema, await request.formData());
		if (
			!parsed.success ||
			!accountBook.remove(locals.user.id, parsed.data.id)
		) {
			return gone();
		}
		return { removed: true };
	},
	rename: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountRenameSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (!accountBook.find(locals.user.id, parsed.data.id)) {
			return gone();
		}
		if (!accountBook.rename(locals.user.id, parsed.data.id, parsed.data.name)) {
			return fail(400, { errors: { name: ["Name the account."] } });
		}
		return { saved: true };
	},
	setType: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const parsed = parseForm(accountTypeSchema, await request.formData());
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		if (
			!accountBook.setType(locals.user.id, parsed.data.id, parsed.data.type)
		) {
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
		if (
			!accountBook.setShared(locals.user.id, parsed.data.id, parsed.data.shared)
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
		if (!account) {
			return gone();
		}
		const minor = parseSignedMoney(parsed.data.amount, account.currency);
		if (minor === undefined) {
			return badAmount();
		}
		accountBook.setBalance(
			locals.user.id,
			account.id,
			minor,
			new Date(`${parsed.data.asOf}T12:00:00Z`),
		);
		return { saved: true };
	},
};
