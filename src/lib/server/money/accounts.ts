import {
	type AccountType,
	type AccountView,
	balanceTotals,
	ownShare,
} from "#lib/account-types.js";
import { AppearanceDTO } from "#lib/dto/appearance.js";
import {
	accountTypeOf,
	balanceOf,
	BankConnectionDTO,
} from "#lib/dto/bank-connection.js";
import { ManualAccountDTO } from "#lib/dto/manual-account.js";

/** Someone's accounts as one list, linked or added by hand: what each is, whether it's shared, its latest balance. */
class AccountBook {
	/**
	 * Every account of `userId`'s linked banks, each with its type and latest balance, synced or typed in, then the ones
	 * they added by hand.
	 */
	list(userId: string): AccountView[] {
		const linked = BankConnectionDTO.forUser(userId).flatMap((connection) => {
			const { id, bankName, bankLogo, syncedAt, lastError } =
				connection.toJSON();
			const syncing = connection.syncing();
			return connection.accounts.map((account) => ({
				id: account.uid,
				connectionId: id,
				bankName,
				bankLogo,
				syncing,
				failed: lastError !== null,
				name: account.name,
				type: accountTypeOf(account),
				currency: account.balance?.currency ?? account.currency,
				shared: account.shared ?? false,
				balance: balanceOf(account),
				syncedAt: syncedAt?.toISOString() ?? null,
			}));
		});
		const byHand = ManualAccountDTO.forUser(userId).map((entry) => {
			const account = entry.toJSON();
			return {
				id: account.id,
				connectionId: null,
				bankName: null,
				bankLogo: null,
				syncing: false,
				failed: false,
				name: account.name,
				type: account.type,
				currency: account.currency,
				shared: account.shared,
				balance: {
					minor: account.balanceMinor,
					currency: account.currency,
					at: account.balanceAt,
					manual: true,
				},
				syncedAt: null,
			};
		});
		return [...linked, ...byHand];
	}

	/**
	 * What `userId`'s own accounts in `currency` hold: savings and investment accounts when `aside`, everyday ones
	 * otherwise. Shared accounts stay out unless `withShared`, then count at half.
	 */
	held(
		userId: string,
		currency: string,
		aside: boolean,
		withShared = false,
	): number {
		const totals = balanceTotals(this.list(userId), currency, withShared);
		return aside ? totals.savedMinor : totals.toSpendMinor;
	}

	/** The part of `account`'s balance that is its owner's: half of a shared one, none without a balance. */
	share(account: AccountView): number {
		return ownShare(account);
	}

	/**
	 * Whether `userId`'s app opens on their money: when they asked for it, or when they never chose and have an account,
	 * linked or added by hand.
	 */
	moneyHomeFor(userId: string): boolean {
		const home = AppearanceDTO.homeFor(userId);
		return (
			home === "money" ||
			(home === null &&
				(BankConnectionDTO.forUser(userId).length > 0 ||
					ManualAccountDTO.forUser(userId).length > 0))
		);
	}

	/** `userId`'s account `id`, or undefined when they have none by that id. */
	find(userId: string, id: string): AccountView | undefined {
		return this.list(userId).find((account) => account.id === id);
	}

	/** Adds an account to `userId` by hand, with what it held on `at`. */
	add(
		userId: string,
		input: {
			name: string;
			type: AccountType;
			currency: string;
			shared: boolean;
			minor: number;
			at: Date;
		},
	): AccountView | undefined {
		const created = ManualAccountDTO.create(userId, {
			name: input.name,
			type: input.type,
			currency: input.currency,
			shared: input.shared || input.type === "joint",
			balanceMinor: input.minor,
			balanceAt: input.at.toISOString(),
		});
		return this.find(userId, created.id);
	}

	/** Deletes `userId`'s account `id` added by hand; false for a linked account or one that isn't theirs. */
	remove(userId: string, id: string): boolean {
		const account = ManualAccountDTO.findForUser(id, userId);
		account?.delete();
		return account !== undefined;
	}

	/**
	 * Makes `userId`'s account `id` of type `type`, a joint one shared; for a linked one, savings and investments then
	 * hold money set aside. False when they have no such account.
	 */
	setType(userId: string, id: string, type: AccountType): boolean {
		const byHand = ManualAccountDTO.findForUser(id, userId);
		if (byHand) {
			byHand.update({
				type,
				shared: type === "joint" ? true : byHand.toJSON().shared,
			});
			return true;
		}
		return this.#connectionOf(userId, id)?.setAccountType(id, type) ?? false;
	}

	/** Marks `userId`'s account `id` shared (counted at half) or not; false when they have no such account. */
	setShared(userId: string, id: string, shared: boolean): boolean {
		const byHand = ManualAccountDTO.findForUser(id, userId);
		if (byHand) {
			byHand.update({ shared });
			return true;
		}
		return (
			this.#connectionOf(userId, id)?.setAccountFlags(id, { shared }) ?? false
		);
	}

	/** Records that `userId`'s account `id` held `minor` on `at`; false when they have no such account. */
	setBalance(userId: string, id: string, minor: number, at: Date): boolean {
		const byHand = ManualAccountDTO.findForUser(id, userId);
		if (byHand) {
			byHand.update({ balanceMinor: minor, balanceAt: at.toISOString() });
			return true;
		}
		return (
			this.#connectionOf(userId, id)?.setManualBalance(id, minor, at) ?? false
		);
	}

	/** The link of `userId` holding account `id`, undefined when none does. */
	#connectionOf(userId: string, id: string): BankConnectionDTO | undefined {
		return BankConnectionDTO.forUser(userId).find((connection) =>
			connection.accounts.some((account) => account.uid === id),
		);
	}
}

export const accountBook = new AccountBook();
