import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createVerify, generateKeyPairSync } from "node:crypto";

import { BankConnectionDTO } from "#lib/dto/bank-connection.js";
import {
	bankCredentialsFor,
	removeBankCredentials,
	saveBankCredentials,
} from "#lib/dto/bank-credential.js";
import { JobDTO } from "#lib/dto/job.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import { bankExpense, syncBank } from "#lib/server/bank-sync.js";
import {
	bankApplicationName,
	type BankTransaction,
	closeBankSession,
	listBanks,
	openBankSession,
	startBankLink,
} from "#lib/server/enable-banking.js";
import { jobHandlers } from "#lib/server/jobs/handlers.js";
import { encryptSecret } from "#lib/server/secrets.js";

import { createUser, resetDatabase } from "../../database.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
	publicKeyEncoding: { type: "spki", format: "pem" },
	privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function credentials() {
	return {
		applicationId: "app-123",
		encryptedPrivateKey: encryptSecret(privateKey),
	};
}

function card(fields: Partial<BankTransaction> = {}): BankTransaction {
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
		expect(await bankApplicationName(credentials())).toBe("OpenCount");
		const headers = new Headers(fetched.mock.calls[0]?.[1]?.headers);
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
						{ uid: "a-1", details: "Main", currency: "EUR" },
						{ uid: "a-2", account_id: { iban: "FR7600001111" } },
					],
				}),
			)
			.mockResolvedValueOnce(Response.json({ message: "OK" }));
		expect(await listBanks(credentials(), "FR")).toEqual([
			{ name: "Revolut", country: "FR", logo: "https://x/l.png" },
			{ name: "Boursorama", country: "FR", logo: null },
		]);
		expect(
			await startBankLink(
				credentials(),
				{ name: "Revolut", country: "FR" },
				"https://app.test/personal/bank",
				"state",
			),
		).toBe("https://bank.test/consent");
		const body = JSON.parse(String(fetched.mock.calls[1]?.[1]?.body)) as {
			psu_type: string;
			redirect_url: string;
		};
		expect(body.psu_type).toBe("personal");
		const session = await openBankSession(credentials(), "code");
		expect(session.sessionId).toBe("s-1");
		expect(session.accounts).toEqual([
			{ uid: "a-1", name: "Main", currency: "EUR" },
			{ uid: "a-2", name: "…1111", currency: "EUR" },
		]);
		await closeBankSession(credentials(), "s-1");
		expect(String(fetched.mock.calls[3]?.[0])).toEndWith("/sessions/s-1");
	});

	test("reports the service's own message when it refuses", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ message: "Wrong redirect URL" }, { status: 422 }),
		);
		await expect(listBanks(credentials(), "FR")).rejects.toThrow(
			"Wrong redirect URL",
		);
	});
});

describe("bank sync", () => {
	beforeEach(resetDatabase);

	test("bankExpense keeps booked lines, money in as income", () => {
		expect(bankExpense("acc", card())).toEqual({
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
		expect(bankExpense("acc", card(), () => "food")?.category).toBe("food");
		expect(
			bankExpense("acc", card({ creditor: { name: "To robo portfolio" } })),
		).toEqual(expect.objectContaining({ aside: true, category: "finance" }));
		expect(
			bankExpense(
				"acc",
				card({
					credit_debit_indicator: "CRDT",
					creditor: null,
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
			bankExpense(
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
		expect(bankExpense("acc", card({ status: "PDNG" }))).toBeUndefined();
		expect(
			bankExpense(
				"acc",
				card({
					transaction_id: null,
					creditor: null,
					remittance_information: ["", " Netflix "],
				}),
			)?.bankRef,
		).toBe("acc:2026-10-20:12.30:Netflix");
	});

	test("syncs new card payments once, pages included, and tells the owner", async () => {
		const ada = createUser("ada");
		saveBankCredentials(ada.id, credentials());
		const connection = link(ada.id);
		spyOn(globalThis, "fetch")
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
			.mockResolvedValueOnce(Response.json({ transactions: [card()] }));
		await jobHandlers["bank.sync"]({ connectionId: connection.id });
		expect(PersonalExpenseDTO.page(ada.id, { limit: 50 }).entries).toHaveLength(
			2,
		);
		expect(JobDTO.counts().pending).toBe(1);
		const again = BankConnectionDTO.find(connection.id);
		expect(await syncBank(again!)).toBe(0);
		expect(again?.fetchFrom()).toBe(
			new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
		);
	});

	test("a link without keys fails and says why", async () => {
		const ada = createUser("ada");
		await expect(syncBank(link(ada.id))).rejects.toThrow("Bank sync is off");
	});

	test("an expired link fails and says why", async () => {
		const ada = createUser("ada");
		const connection = link(ada.id, new Date(Date.now() - 1000));
		await expect(syncBank(connection)).rejects.toThrow("expired");
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
