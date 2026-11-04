import type { AccountType } from "#lib/account-types.js";
import {
	accountTypeOf,
	balanceOf,
	BankConnectionDTO,
} from "#lib/dto/bank-connection.js";

export interface AccountView {
	id: string;
	connectionId: string;
	bankName: string;
	name: string;
	type: AccountType;
	currency: string;
	shared: boolean;
	balance: {
		minor: number;
		currency: string;
		at: string;
		manual: boolean;
	} | null;
	syncedAt: string | null;
}

/** Someone's accounts as one list: what each is, whether it's shared, and its latest balance. */
class AccountBook {
	/** Every account of `userId`'s linked banks, each with its type and latest balance, synced or typed in. */
	list(userId: string): AccountView[] {
		return BankConnectionDTO.forUser(userId).flatMap((connection) => {
			const { id, bankName, syncedAt } = connection.toJSON();
			return connection.accounts.map((account) => ({
				id: account.uid,
				connectionId: id,
				bankName,
				name: account.name,
				type: accountTypeOf(account),
				currency: account.balance?.currency ?? account.currency,
				shared: account.shared ?? false,
				balance: balanceOf(account),
				syncedAt: syncedAt?.toISOString() ?? null,
			}));
		});
	}

	/**
	 * What `userId`'s accounts in `currency` hold, a shared one at half: savings and investment accounts when `aside`,
	 * everyday ones otherwise.
	 */
	held(userId: string, currency: string, aside: boolean): number {
		return this.list(userId)
			.filter(
				(account) =>
					(account.type === "savings" || account.type === "investment") ===
						aside && account.balance?.currency === currency,
			)
			.reduce((total, account) => total + this.share(account), 0);
	}

	/** The part of `account`'s balance that is its owner's: half of a shared one, none without a balance. */
	share(account: AccountView): number {
		const minor = account.balance?.minor ?? 0;
		return account.shared ? Math.trunc(minor / 2) : minor;
	}

	/** `userId`'s account `id`, or undefined when none of their links has it. */
	find(userId: string, id: string): AccountView | undefined {
		return this.list(userId).find((account) => account.id === id);
	}

	/** The link of `userId` holding account `id`, to change it; undefined when none does. */
	connectionOf(userId: string, id: string): BankConnectionDTO | undefined {
		return BankConnectionDTO.forUser(userId).find((connection) =>
			connection.accounts.some((account) => account.uid === id),
		);
	}
}

export const accountBook = new AccountBook();
