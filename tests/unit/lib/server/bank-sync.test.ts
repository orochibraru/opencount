import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createVerify, generateKeyPairSync } from "node:crypto";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import {
	bankCredentialsFor,
	removeBankCredentials,
	saveBankCredentials,
} from "#lib/dto/bank-credential.js";
import { JobDTO } from "#lib/dto/job.js";
import {
	type BankExpense,
	PersonalExpenseDTO,
} from "#lib/dto/personal-expense.js";
import { setSetting } from "#lib/dto/setting.js";
import { bankSync } from "#lib/server/banking/bank-sync.js";
import type { Transaction } from "#lib/server/banking/enable-banking-api.js";
import { EnableBankingClient } from "#lib/server/banking/enable-banking.js";
import { secrets } from "#lib/server/core/secrets.js";
import { jobHandlers } from "#lib/server/jobs/handlers.js";

import { createUser, resetDatabase } from "../../database.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
	publicKeyEncoding: { type: "spki", format: "pem" },
	privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function credentials() {
	return {
		applicationId: "app-123",
		encryptedPrivateKey: secrets.encrypt(privateKey),
	};
}

function sent(fetched: { mock: { calls: unknown[][] } }, index: number) {
	const request = fetched.mock.calls[index]?.[0];
	if (!(request instanceof Request)) {
		throw new TypeError(`Request ${index} wasn't sent.`);
	}
	return request;
}

function card(fields: Partial<Transaction> = {}): Transaction {
	return {
		transaction_id: "t1",
		transaction_amount: { amount: "12.30", currency: "EUR" },
		credit_debit_indicator: "DBIT",
		status: "BOOK",
		booking_date: "2026-10-20",
		creditor: { name: "Carrefour City" },
		...fields,
	};
}

function link(userId: string, validUntil = new Date(Date.now() + 86_400_000)) {
	return BankConnectionDTO.create(userId, {
		sessionId: "session-1",
		bankName: "Revolut",
		bankCountry: "FR",
		accounts: [{ uid: "acc-1", name: "Main", currency: "EUR" }],
		validUntil,
	});
}

afterEach(() => {
	spyOn(globalThis, "fetch").mockRestore();
});

describe("Enable Banking client", () => {
	beforeEach(resetDatabase);

	test("signs each call with a short-lived RS256 token for the application", async () => {
		const ada = createUser("ada");
		expect(bankCredentialsFor(ada.id)).toBeUndefined();
		saveBankCredentials(ada.id, credentials());
		saveBankCredentials(ada.id, { ...credentials(), applicationId: "app-123" });
		expect(bankCredentialsFor(ada.id)?.applicationId).toBe("app-123");
		removeBankCredentials(ada.id);
		expect(bankCredentialsFor(ada.id)).toBeUndefined();
		const fetched = spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ name: "OpenCount" }),
		);
		expect(await new EnableBankingClient(credentials()).applicationName()).toBe(
			"OpenCount",
		);
		const { headers } = sent(fetched, 0);
		const [header = "", body = "", signature = ""] = (
			headers.get("Authorization") ?? ""
		)
			.replace("Bearer ", "")
			.split(".");
		expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
			typ: "JWT",
			alg: "RS256",
			kid: "app-123",
		});
		expect(JSON.parse(Buffer.from(body, "base64url").toString())).toEqual(
			expect.objectContaining({
				iss: "enablebanking.com",
				aud: "api.enablebanking.com",
			}),
		);
		expect(
			createVerify("RSA-SHA256")
				.update(`${header}.${body}`)
				.verify(publicKey, Buffer.from(signature, "base64url")),
		).toBe(true);
	});

	test("lists banks, starts a link, opens a session and closes it", async () => {
		const fetched = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				Response.json({
					aspsps: [
						{ name: "Revolut", country: "FR", logo: "https://x/l.png" },
						{ name: "Boursorama", country: "FR", logo: "javascript:alert(1)" },
					],
				}),
			)
			.mockResolvedValueOnce(
				Response.json({ url: "https://bank.test/consent" }),
			)
			.mockResolvedValueOnce(
				Response.json({
					session_id: "s-1",
					aspsp: { name: "Revolut", country: "FR" },
					access: { valid_until: "2027-01-20T00:00:00Z" },
					accounts: [
						{
							uid: "a-1",
							details: "Main",
							currency: "EUR",
							identification_hash: "hash-1",
						},
						{
							uid: "a-2",
							account_id: { iban: "FR7600001111" },
							cash_account_type: "SVGS",
						},
						{ uid: null, details: "Card that can't be read" },
					],
				}),
			)
			.mockResolvedValueOnce(Response.json({ message: "OK" }));
		expect(
			await new EnableBankingClient(credentials()).listBanks("FR"),
		).toEqual([
			{ name: "Revolut", country: "FR", logo: "https://x/l.png" },
			{ name: "Boursorama", country: "FR", logo: null },
		]);
		expect(
			await new EnableBankingClient(credentials()).startLink(
				{ name: "Revolut", country: "FR" },
				"https://app.test/personal/bank",
				"state",
			),
		).toBe("https://bank.test/consent");
		const body = (await sent(fetched, 1).json()) as {
			psu_type: string;
			redirect_url: string;
		};
		expect(body.psu_type).toBe("personal");
		const session = await new EnableBankingClient(credentials()).openSession(
			"code",
		);
		expect(session.sessionId).toBe("s-1");
		expect(session.accounts).toEqual([
			{
				uid: "a-1",
				name: "Main",
				currency: "EUR",
				identificationHash: "hash-1",
				savings: false,
			},
			{
				uid: "a-2",
				name: "…1111",
				currency: "EUR",
				identificationHash: undefined,
				savings: true,
			},
		]);
		expect(session.listedAccounts).toBe(3);
		await new EnableBankingClient(credentials()).closeSession("s-1");
		expect(sent(fetched, 3).url).toEndWith("/sessions/s-1");
	});

	test("reports the service's own message when it refuses", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ message: "Wrong redirect URL" }, { status: 422 }),
		);
		await expect(
			new EnableBankingClient(credentials()).listBanks("FR"),
		).rejects.toThrow("Wrong redirect URL");
	});
});

describe("bank sync", () => {
	beforeEach(resetDatabase);

	test("bankExpense keeps booked lines, money in as income", () => {
		expect(bankSync.bankExpense("acc", card())).toEqual({
			description: "Carrefour City",
			category: "groceries",
			kind: "expense",
			amountMinor: 1230,
			currency: "EUR",
			spentOn: "2026-10-20",
			aside: false,
			bankRef: "acc:t1",
			bankAccountUid: "acc",
		});
		expect(bankSync.bankExpense("acc", card(), () => "food")?.category).toBe(
			"food",
		);
		expect(
			bankSync.bankExpense(
				"acc",
				card({ creditor: { name: "To robo portfolio" } }),
			),
		).toEqual(expect.objectContaining({ aside: true, category: "finance" }));
		expect(
			bankSync.bankExpense(
				"acc",
				card({
					credit_debit_indicator: "CRDT",
					creditor: undefined,
					debtor: { name: "ACME Payroll" },
				}),
			),
		).toEqual(
			expect.objectContaining({
				description: "ACME Payroll",
				kind: "income",
				category: "income",
			}),
		);
		expect(
			bankSync.bankExpense(
				"acc",
				card({
					credit_debit_indicator: "CRDT",
					debtor: { name: "From robo portfolio" },
				}),
			),
		).toEqual(
			expect.objectContaining({
				kind: "income",
				aside: true,
				category: "finance",
			}),
		);
		expect(
			bankSync.bankExpense("acc", card({ status: "PDNG" })),
		).toBeUndefined();
		expect(
			bankSync.bankExpense(
				"acc",
				card({
					transaction_id: undefined,
					creditor: undefined,
					remittance_information: ["", " Netflix "],
				}),
			)?.bankRef,
		).toBe("acc:2026-10-20:12.30:Netflix");
	});

	test("syncs new card payments once, pages included, and tells the owner", async () => {
		const ada = createUser("ada");
		saveBankCredentials(ada.id, credentials());
		const connection = link(ada.id);
		const fetched = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				Response.json({
					aspsps: [
						{
							name: "Revolut",
							country: "FR",
							logo: "https://logos.example/revolut.png",
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				Response.json({ transactions: [card()], continuation_key: "next" }),
			)
			.mockResolvedValueOnce(
				Response.json({
					transactions: [
						card({ transaction_id: "t2", creditor: { name: "SNCF" } }),
					],
				}),
			)
			.mockResolvedValueOnce(
				Response.json({
					balances: [
						{
							name: "Booked",
							balance_type: "CLBD",
							balance_amount: { amount: "90.00", currency: "EUR" },
						},
						{
							name: "Available",
							balance_type: "ITAV",
							balance_amount: { amount: "123.45", currency: "EUR" },
						},
					],
				}),
			)
			.mockResolvedValueOnce(Response.json({ transactions: [card()] }))
			.mockResolvedValueOnce(Response.json({ balances: [] }));
		await jobHandlers["bank.sync"]({ connectionId: connection.id });
		expect(sent(fetched, 1).url).toContain("strategy=longest");
		expect(PersonalExpenseDTO.page(ada.id, { limit: 50 }).entries).toHaveLength(
			2,
		);
		expect(JobDTO.counts().pending).toBe(1);
		const again = BankConnectionDTO.find(connection.id);
		expect(again?.toJSON()).toEqual(
			expect.objectContaining({
				bankLogo: "https://logos.example/revolut.png",
				syncState: "idle",
				lastAdded: 2,
				lastError: null,
				lastReport: [{ accountUid: "acc-1", fetched: 2, booked: 2, added: 2 }],
			}),
		);
		expect(again?.syncing()).toBe(false);
		expect(await bankSync.sync(again!)).toBe(0);
		expect(again?.accounts[0]?.balance).toEqual(
			expect.objectContaining({ minor: 12_345, currency: "EUR" }),
		);
		expect(sent(fetched, 4).url).toContain(
			`date_from=${new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)}`,
		);
		expect(PersonalExpenseDTO.historyFromBank(ada.id)).toEqual({
			[connection.id]: "2026-10-20",
		});
	});

	test("a queued sync shows as syncing until the worker runs or it goes stale", () => {
		const ada = createUser("ada");
		const connection = link(ada.id);
		expect(connection.fetchFrom()).toBeUndefined();
		bankSync.queue(connection);
		expect(connection.syncing()).toBe(true);
		expect(JobDTO.counts().pending).toBe(1);
		expect(connection.syncing(new Date(Date.now() + 16 * 60_000))).toBe(false);
	});

	test("a link that shares no account fails and says how to fix it", async () => {
		const ada = createUser("ada");
		saveBankCredentials(ada.id, credentials());
		const connection = BankConnectionDTO.create(ada.id, {
			sessionId: "session-2",
			bankName: "Crédit Mutuel",
			bankCountry: "FR",
			accounts: [],
			validUntil: new Date(Date.now() + 86_400_000),
		});
		connection.setLogo("https://logos.example/cm.png");
		await expect(bankSync.sync(connection)).rejects.toThrow(
			"can't read any account",
		);
		expect(connection.toJSON().lastError).toContain("relink the bank");
	});

	test("relinking carries each account's lines over to its new uid", async () => {
		const ada = createUser("ada");
		saveBankCredentials(ada.id, credentials());
		const connection = BankConnectionDTO.create(ada.id, {
			sessionId: "session-1",
			bankName: "Revolut",
			bankCountry: "FR",
			accounts: [
				{ uid: "old-1", name: "…9040", currency: "EUR" },
				{ uid: "old-3", name: "…9040", currency: "EUR" },
				{ uid: "old-4", name: "Pocket", currency: "EUR" },
				{
					uid: "old-2",
					name: "Savings",
					currency: "EUR",
					identificationHash: "hash-2",
				},
			],
			validUntil: new Date(Date.now() + 86_400_000),
		});
		PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
			bankSync.bankExpense("old-1", card())!,
			bankSync.bankExpense("old-2", card({ transaction_id: "t9" }))!,
			bankSync.bankExpense("old-4", card({ transaction_id: "t4" }))!,
		]);
		connection.markSynced(3);
		const fetched = spyOn(globalThis, "fetch").mockResolvedValueOnce(
			Response.json({
				accounts_data: [
					{ uid: "old-1", identification_hash: "hash-1" },
					{ uid: "old-3", identification_hash: "hash-3" },
				],
			}),
		);
		const accounts = [
			{
				uid: "new-1",
				name: "…9040",
				currency: "EUR",
				identificationHash: "hash-1",
			},
			{
				uid: "new-2",
				name: "Renamed",
				currency: "EUR",
				identificationHash: "hash-2",
			},
			{ uid: "new-4", name: "Pocket", currency: "EUR" },
		];
		const relink = {
			sessionId: "session-2",
			bankName: "Revolut",
			bankCountry: "FR",
			listedAccounts: 3,
			validUntil: new Date(Date.now() + 2 * 86_400_000),
			accounts,
		};
		await bankSync.relink(connection, relink, credentials());
		expect(sent(fetched, 0).url).toEndWith("/sessions/session-1");
		const again = BankConnectionDTO.find(connection.id);
		expect(again?.sessionId).toBe("session-2");
		expect(again?.fetchFrom()).toBeUndefined();
		expect(again?.accounts.map((account) => account.uid)).toEqual([
			"new-1",
			"new-2",
			"new-4",
		]);
		expect(
			PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
				bankSync.bankExpense("new-1", card())!,
				bankSync.bankExpense("new-2", card({ transaction_id: "t9" }))!,
				bankSync.bankExpense("new-4", card({ transaction_id: "t4" }))!,
			]),
		).toBe(0);
		expect(
			PersonalExpenseDTO.page(ada.id, { limit: 50, accountUid: "new-2" })
				.entries,
		).toHaveLength(1);
		fetched.mockRejectedValueOnce(new Error("offline"));
		await bankSync.relink(
			again!,
			{ ...relink, sessionId: "session-3", accounts: [accounts[2]!] },
			credentials(),
		);
		expect(fetched).toHaveBeenCalledTimes(2);
		expect(BankConnectionDTO.find(connection.id)?.sessionId).toBe("session-3");
	});

	test("a link without keys fails and says why", async () => {
		const ada = createUser("ada");
		await expect(bankSync.sync(link(ada.id))).rejects.toThrow(
			"Bank sync is off",
		);
	});

	test("an expired link fails and says why", async () => {
		const ada = createUser("ada");
		const connection = link(ada.id, new Date(Date.now() - 1000));
		await expect(bankSync.sync(connection)).rejects.toThrow("expired");
		expect(BankConnectionDTO.forUser(ada.id)[0]?.toJSON().lastError).toContain(
			"expired",
		);
		expect(BankConnectionDTO.activeIds()).toEqual([]);
	});

	test("syncAll queues every live link and plans the next day", async () => {
		const ada = createUser("ada");
		link(ada.id);
		await jobHandlers["bank.syncAll"]({});
		expect(JobDTO.counts().pending).toBe(2);
		const next = JobDTO.nextRun("bank.syncAll");
		expect(next?.getUTCHours()).toBe(6);
		expect(next!.getTime()).toBeGreaterThan(Date.now());
		expect(next!.getTime()).toBeLessThanOrEqual(Date.now() + 86_400_000);
		await jobHandlers["bank.sync"]({ connectionId: "gone" });
	});
});

describe("PersonalExpenseDTO", () => {
	beforeEach(resetDatabase);

	test("keeps each account's expenses apart and hides deleted bank ones", () => {
		const ada = createUser("ada");
		const grace = createUser("grace");
		const id = PersonalExpenseDTO.create(ada.id, {
			description: "Book",
			category: "shopping",
			amountMinor: 1500,
			currency: "EUR",
			spentOn: "2026-10-01",
		});
		const connection = link(ada.id);
		expect(
			PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
				{
					description: "Taxi",
					category: "transport",
					amountMinor: 900,
					currency: "EUR",
					spentOn: "2026-10-02",
					bankRef: "acc:1",
					bankAccountUid: "acc",
				},
			]),
		).toBe(1);
		expect(PersonalExpenseDTO.importFromBank(ada.id, connection.id, [])).toBe(
			0,
		);
		expect(PersonalExpenseDTO.findForUser(id, grace.id)).toBeUndefined();
		const book = PersonalExpenseDTO.findForUser(id, ada.id);
		book?.update({
			description: "Novel",
			category: "shopping",
			amountMinor: 1600,
			currency: "EUR",
			spentOn: "2026-10-01",
		});
		const [taxi, novel] = PersonalExpenseDTO.page(ada.id, {
			limit: 50,
		}).entries;
		expect(taxi?.toJSON()).toEqual(
			expect.objectContaining({ fromBank: true, bankName: "Revolut" }),
		);
		expect(novel?.toJSON().description).toBe("Novel");
		taxi?.delete();
		novel?.delete();
		expect(PersonalExpenseDTO.page(ada.id, { limit: 50 }).entries).toEqual([]);
		expect(
			PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
				{
					description: "Taxi",
					category: "transport",
					amountMinor: 900,
					currency: "EUR",
					spentOn: "2026-10-02",
					bankRef: "acc:1",
					bankAccountUid: "acc",
				},
			]),
		).toBe(0);
		connection.delete();
		expect(BankConnectionDTO.forUser(ada.id)).toEqual([]);
	});

	test("a note on a bank line is searchable and survives the next sync", () => {
		const ada = createUser("ada");
		const connection = link(ada.id);
		const card = {
			description: "CB AMZN MKTP",
			category: "shopping",
			amountMinor: 4200,
			currency: "EUR",
			spentOn: "2026-10-03",
			bankRef: "acc:2",
			bankAccountUid: "acc",
		};
		PersonalExpenseDTO.importFromBank(ada.id, connection.id, [card]);
		const [line] = PersonalExpenseDTO.page(ada.id, { limit: 50 }).entries;
		line?.update({ ...card, note: "Birthday present for Grace" });
		expect(
			PersonalExpenseDTO.importFromBank(ada.id, connection.id, [card]),
		).toBe(0);
		const found = PersonalExpenseDTO.page(ada.id, {
			limit: 50,
			search: "birthday",
		}).entries;
		expect(found.map((entry) => entry.toJSON().note)).toEqual([
			"Birthday present for Grace",
		]);
	});
});

describe("transfers between own accounts", () => {
	beforeEach(resetDatabase);

	function twoAccounts(userId: string) {
		return BankConnectionDTO.create(userId, {
			sessionId: "session-1",
			bankName: "Revolut",
			bankCountry: "FR",
			accounts: [
				{ uid: "main", name: "Main", currency: "EUR" },
				{ uid: "joint", name: "Joint", currency: "EUR" },
			],
			validUntil: new Date(Date.now() + 86_400_000),
		});
	}

	function line(
		uid: string,
		ref: string,
		fields: Partial<BankExpense> = {},
	): BankExpense {
		return {
			description: "Transfer",
			category: "other",
			kind: "expense",
			amountMinor: 5000,
			currency: "EUR",
			spentOn: "2026-10-10",
			bankRef: `${uid}:${ref}`,
			bankAccountUid: uid,
			...fields,
		};
	}

	test("pairs money moved between accounts as internal, left out of spent and income", () => {
		const ada = createUser("ada");
		const connection = twoAccounts(ada.id);
		PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
			line("main", "out", { category: "family" }),
			line("joint", "in", {
				kind: "income",
				category: "income",
				spentOn: "2026-10-12",
			}),
			line("main", "food", { category: "food", amountMinor: 2000 }),
			line("joint", "far", {
				kind: "income",
				category: "income",
				spentOn: "2026-10-20",
			}),
		]);
		expect(bankSync.pairTransfers(ada.id)).toBe(1);
		expect(bankSync.pairTransfers(ada.id)).toBe(0);
		const stats = PersonalExpenseDTO.stats(ada.id);
		expect(stats.totals).toEqual([{ currency: "EUR", minor: 2000 }]);
		expect(stats.income).toEqual([{ currency: "EUR", minor: 5000 }]);
		expect(
			PersonalExpenseDTO.spending(ada.id).map((row) => row.category),
		).toEqual(["food", "income"]);
	});

	test("money into savings counts as set aside, and a refiled line stays as the person left it", () => {
		const ada = createUser("ada");
		const connection = twoAccounts(ada.id);
		connection.setAccountFlags("joint", { savings: true });
		PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
			line("main", "out"),
			line("joint", "in", { kind: "income", category: "income" }),
		]);
		bankSync.pairTransfers(ada.id);
		const lines = PersonalExpenseDTO.transferLines(ada.id);
		expect(lines.find((entry) => entry.kind === "expense")).toEqual(
			expect.objectContaining({ category: "finance", aside: true }),
		);
		expect(lines.find((entry) => entry.kind === "income")?.category).toBe(
			"internal",
		);
		const out = lines.find((entry) => entry.kind === "expense")!;
		PersonalExpenseDTO.recategorize(ada.id, [out.id], "family");
		connection.setAccountFlags("joint", { savings: false });
		bankSync.pairTransfers(ada.id);
		expect(
			PersonalExpenseDTO.transferLines(ada.id).find(
				(entry) => entry.id === out.id,
			)?.category,
		).toBe("family");
	});

	test("a shared account's lines count at half", () => {
		const ada = createUser("ada");
		const connection = twoAccounts(ada.id);
		expect(connection.setAccountFlags("joint", { shared: true })).toBe(true);
		expect(connection.setAccountFlags("gone", { shared: true })).toBe(false);
		PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
			line("joint", "rent", { category: "home", amountMinor: 120_001 }),
			line("main", "food", { category: "food", amountMinor: 1000 }),
		]);
		expect(BankConnectionDTO.sharedAccountUids(ada.id)).toEqual(["joint"]);
		expect(PersonalExpenseDTO.stats(ada.id).totals).toEqual([
			{ currency: "EUR", minor: 61_000 },
		]);
		expect(
			PersonalExpenseDTO.spending(ada.id).map((row) => row.amountMinor),
		).toEqual([60_000, 1000]);
	});
});

describe("account names", () => {
	beforeEach(resetDatabase);

	test("a renamed account keeps its name through a relink and an empty name brings the bank's back", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ message: "Session gone" }, { status: 404 }),
		);
		const ada = createUser("ada");
		const connection = link(ada.id);
		expect(connection.renameAccount("acc-1", "Daily")).toBe(true);
		expect(connection.renameAccount("gone", "Daily")).toBe(false);
		expect(connection.accounts[0]).toEqual(
			expect.objectContaining({ name: "Daily", originalName: "Main" }),
		);
		await bankSync.relink(
			connection,
			{
				sessionId: "session-2",
				bankName: "Revolut",
				bankCountry: "FR",
				listedAccounts: 1,
				validUntil: new Date(Date.now() + 86_400_000),
				accounts: [{ uid: "acc-2", name: "Main", currency: "EUR" }],
			},
			credentials(),
		);
		expect(connection.accounts[0]).toEqual(
			expect.objectContaining({
				uid: "acc-2",
				name: "Daily",
				originalName: "Main",
			}),
		);
		connection.renameAccount("acc-2", "");
		expect(connection.accounts[0]?.name).toBe("Main");
		expect(connection.accounts[0]?.originalName).toBeUndefined();
	});
});

describe("reading what banks send", () => {
	beforeEach(resetDatabase);

	test("a card line names the merchant from the lines after its generic first one, on the day the card paid", () => {
		const cardLine = card({
			transaction_id: undefined,
			creditor: undefined,
			booking_date: "2026-10-27",
			remittance_information: [
				"PAIEMENT CB  2310 PARIS1234567/",
				"AMAZON  PAYMENTS",
			],
		});
		expect(bankSync.bankExpense("acc", cardLine)).toEqual(
			expect.objectContaining({
				description: "AMAZON PAYMENTS",
				spentOn: "2026-10-23",
				bankRef: "acc:2026-10-27:12.30:PAIEMENT CB  2310 PARIS1234567/",
			}),
		);
		expect(
			bankSync.bankExpense(
				"acc",
				card({
					creditor: undefined,
					booking_date: "2026-01-03",
					remittance_information: ["PAIEMENT MOB 3012 LYON"],
				}),
			),
		).toEqual(
			expect.objectContaining({
				description: "PAIEMENT MOB 3012 LYON",
				spentOn: "2025-12-30",
			}),
		);
	});

	test("an unknown merchant is filed by its card merchant code", () => {
		const opaque = card({ creditor: { name: "ZORBLAX 42" } });
		expect(
			bankSync.bankExpense("acc", { ...opaque, merchant_category_code: "5541" })
				?.category,
		).toBe("transport");
		expect(
			bankSync.bankExpense("acc", { ...opaque, merchant_category_code: "3012" })
				?.category,
		).toBe("transport");
		expect(
			bankSync.bankExpense("acc", { ...opaque, merchant_category_code: "7011" })
				?.category,
		).toBe("lodging");
		expect(bankSync.bankExpense("acc", opaque)?.category).toBe("other");
	});

	test("a line still under Other takes the name a later sync reads, a filed one stays", () => {
		const ada = createUser("ada");
		const connection = link(ada.id);
		const old = {
			description: "PAIEMENT CB  2310 PARIS1234567/",
			category: "other",
			kind: "expense" as const,
			amountMinor: 1230,
			currency: "EUR",
			spentOn: "2026-10-23",
			bankAccountUid: "acc-1",
		};
		PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
			{ ...old, bankRef: "acc-1:a" },
			{ ...old, bankRef: "acc-1:b", category: "food" },
		]);
		expect(
			PersonalExpenseDTO.refreshUncategorized(ada.id, [
				{
					...old,
					bankRef: "acc-1:a",
					description: "Amazon",
					category: "shopping",
				},
				{
					...old,
					bankRef: "acc-1:b",
					description: "Amazon",
					category: "shopping",
				},
			]),
		).toBe(1);
		expect(
			PersonalExpenseDTO.page(ada.id, { limit: 10 })
				.entries.map((entry) => entry.toJSON())
				.map(({ description, category }) => `${description}:${category}`)
				.toSorted(),
		).toEqual(["Amazon:shopping", "PAIEMENT CB  2310 PARIS1234567/:food"]);
	});

	test("money coming into a shared account is someone else's, not income", () => {
		const ada = createUser("ada");
		const connection = link(ada.id);
		const base = {
			category: "income",
			kind: "income" as const,
			amountMinor: 82_000,
			currency: "EUR",
			spentOn: "2026-10-23",
			bankAccountUid: "acc-1",
		};
		PersonalExpenseDTO.importFromBank(ada.id, connection.id, [
			{ ...base, description: "VIR DE PARTNER", bankRef: "acc-1:in" },
		]);
		PersonalExpenseDTO.create(ada.id, {
			description: "Cash gift",
			category: "income",
			kind: "income",
			amountMinor: 1000,
			currency: "EUR",
			spentOn: "2026-10-23",
		});
		expect(PersonalExpenseDTO.stats(ada.id).income).toEqual([
			{ currency: "EUR", minor: 83_000 },
		]);
		connection.setAccountFlags("acc-1", { shared: true });
		expect(PersonalExpenseDTO.stats(ada.id).income).toEqual([
			{ currency: "EUR", minor: 1000 },
		]);
		expect(PersonalExpenseDTO.spending(ada.id)).toHaveLength(1);
	});
});

describe("bank sync turned off", () => {
	beforeEach(resetDatabase);

	test("an admin turning it off stops the daily syncs and every queued one", async () => {
		const ada = createUser("ada");
		saveBankCredentials(ada.id, credentials());
		const connection = link(ada.id);
		setSetting("bankSyncEnabled", false);
		expect(bankSync.enabled()).toBe(false);
		await jobHandlers["bank.syncAll"]({});
		expect(JobDTO.counts().pending).toBe(1);
		const fetched = spyOn(globalThis, "fetch");
		await jobHandlers["bank.sync"]({ connectionId: connection.id });
		expect(fetched).not.toHaveBeenCalled();
	});
});

describe("Finance in the totals", () => {
	beforeEach(resetDatabase);

	test("loans, fees and cash are counted apart from what was spent", () => {
		const ada = createUser("ada");
		const add = (category: string, amountMinor: number, aside = false) =>
			PersonalExpenseDTO.create(ada.id, {
				description: category,
				category,
				amountMinor,
				currency: "EUR",
				spentOn: "2026-10-10",
				aside,
			});
		add("food", 1000);
		add("finance", 120_000);
		add("finance", 500, true);
		const stats = PersonalExpenseDTO.stats(ada.id);
		expect(stats.totals).toEqual([{ currency: "EUR", minor: 1000 }]);
		expect(stats.finance).toEqual([{ currency: "EUR", minor: 120_000 }]);
		expect(stats.aside).toEqual([{ currency: "EUR", minor: 500 }]);
		expect(stats.byCategory.map((row) => row.category)).toEqual(["food"]);
	});
});

describe("folders", () => {
	beforeEach(resetDatabase);

	test("files only the person's own expenses in a folder and takes them out", async () => {
		const { PersonalFolderDTO } = await import("#lib/dto/personal-folder.js");
		const ada = createUser("ada");
		const grace = createUser("grace");
		const entry = {
			description: "Hotel",
			category: "lodging",
			amountMinor: 9000,
			currency: "EUR",
			spentOn: "2026-10-10",
		};
		const mine = PersonalExpenseDTO.create(ada.id, entry);
		const theirs = PersonalExpenseDTO.create(grace.id, entry);
		const trip = PersonalFolderDTO.create(ada.id, "Lisbon trip");
		expect(PersonalExpenseDTO.moveToFolder(ada.id, [mine, theirs], trip)).toBe(
			1,
		);
		expect(
			PersonalFolderDTO.findForUser(trip, ada.id)?.toJSON().expenseCount,
		).toBe(1);
		expect(PersonalExpenseDTO.moveToFolder(ada.id, [mine], null)).toBe(1);
		expect(
			PersonalFolderDTO.findForUser(trip, ada.id)?.toJSON().expenseCount,
		).toBe(0);
	});
});
