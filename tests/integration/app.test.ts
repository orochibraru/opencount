import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { type RunningApp, startApp } from "../support/app.js";
import { Client } from "../support/client.js";

const admin = {
	email: "ada@example.com",
	name: "Ada",
	password: "Correct-Horse-Battery-9",
};

let app: RunningApp;
let database: Database;

function row<Row>(query: string, ...values: string[]): Row | undefined {
	return database.query(query).get(...values) as Row | undefined;
}

beforeAll(async () => {
	app = await startApp(4410);
	database = new Database(app.databasePath, { readonly: true });
});

afterAll(async () => {
	database?.close();
	await app?.stop();
});

describe("a fresh instance", () => {
	test("answers its health check", async () => {
		const response = await fetch(`${app.origin}/api/health`);
		expect(response.status).toBe(200);
	});

	test("sends every page to the setup flow", async () => {
		const response = await new Client(app.origin).get("/");
		expect(response.status).toBeGreaterThanOrEqual(300);
		expect(response.headers.get("location")).toContain("/auth/setup");
	});

	test("refuses a wrong setup code and a form from another origin", async () => {
		const client = new Client(app.origin);
		expect(
			(await client.action("/auth/setup", "verify", { code: "000000" })).type,
		).toBe("failure");
		const crossSite = await client.action(
			"/auth/setup",
			"verify",
			{ code: await app.setupCode() },
			"https://evil.example",
		);
		expect(crossSite.status).toBe(403);
	});

	test("won't create the admin before the code is entered", async () => {
		const result = await new Client(app.origin).action(
			"/auth/setup",
			"create",
			{
				...admin,
				confirmPassword: admin.password,
			},
		);
		expect(result.type).toBe("failure");
	});
});

describe("setting up and using it", () => {
	const client = () => signedIn;
	let signedIn: Client;

	beforeAll(async () => {
		signedIn = new Client(app.origin);
		const verified = await signedIn.action("/auth/setup", "verify", {
			code: await app.setupCode(),
		});
		expect(verified.type).toBe("success");
		const created = await signedIn.action("/auth/setup", "create", {
			...admin,
			confirmPassword: admin.password,
		});
		expect(created.type).toBe("redirect");
		expect(created.location).toContain("admin/overview");
	});

	test("the first account is the admin, and setup is closed after it", async () => {
		expect(
			row<{ role: string }>(
				"select role from user where email = ?",
				admin.email,
			)?.role,
		).toBe("admin");
		const again = await new Client(app.origin).get("/auth/setup");
		expect(again.headers.get("location")).toContain("/auth/sign-in");
		expect((await client().get("/admin/overview")).status).toBe(200);
	});

	test("signing in checks the password", async () => {
		const stranger = new Client(app.origin);
		const wrong = await stranger.action("/auth/sign-in", "password", {
			email: admin.email,
			password: "not-the-password",
		});
		expect(wrong.type).toBe("failure");
		const right = await stranger.action("/auth/sign-in", "password", {
			email: admin.email,
			password: admin.password,
		});
		expect(right.type).toBe("redirect");
		const home = await stranger.get("/");
		expect(home.status).toBe(200);
		expect(home.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
		);
	});

	test("a group, an expense, its merchant and a repeating copy", async () => {
		const created = await client().action("/", "create", {
			name: "Lisbon trip",
			currency: "EUR",
		});
		expect(created.type).toBe("success");
		const group = row<{ id: string }>(
			"select id from `group` where name = ?",
			"Lisbon trip",
		);
		const member = row<{ id: string }>(
			"select id from group_member where group_id = ?",
			group?.id ?? "",
		);
		expect(group && member).toBeTruthy();
		const groupPath = `/groups/${group?.id}`;

		const added = await client().action(groupPath, "create", {
			description: "Dinner at the harbour",
			amount: "42.50",
			category: "food",
			paidBy: member?.id ?? "",
			spentOn: "2026-01-31",
			splitMode: "equal",
			participants: [member?.id ?? ""],
			merchant: "Cervejaria Ramiro",
			repeat: "monthly",
		});
		expect(added.type).toBe("success");

		const expenses = database
			.query(
				"select amount_minor, merchant_id, recurring_id from expense where group_id = ? order by spent_on",
			)
			.all(group?.id ?? "") as {
			amount_minor: number;
			merchant_id: string | null;
			recurring_id: string | null;
		}[];
		expect(expenses.length).toBeGreaterThan(1);
		expect(expenses.every((entry) => entry.amount_minor === 4250)).toBe(true);
		expect(expenses.every((entry) => entry.merchant_id !== null)).toBe(true);
		expect(
			row<{ anchor_day: number }>(
				"select anchor_day from recurring_expense where group_id = ?",
				group?.id ?? "",
			)?.anchor_day,
		).toBe(31);

		const insights = await client().get(`${groupPath}/analytics?period=all`);
		expect(insights.status).toBe(200);
		expect(await insights.text()).toContain("Cervejaria Ramiro");
	});

	test("a group stays private to its members", async () => {
		const group = row<{ id: string }>(
			"select id from `group` where name = ?",
			"Lisbon trip",
		);
		const outsider = new Client(app.origin);
		const response = await outsider.get(`/groups/${group?.id}`);
		expect(response.headers.get("location")).toContain("/auth/sign-in");
		const missing = await client().get("/groups/not-a-group");
		expect(missing.status).toBe(404);
	});

	test("archiving hides a group for its member only", async () => {
		const group = row<{ id: string }>(
			"select id from `group` where name = ?",
			"Lisbon trip",
		);
		const archived = await client().action(
			`/groups/${group?.id}/settings/general`,
			"setArchived",
			{ archived: "true" },
		);
		expect(archived.type).toBe("success");
		expect(await (await client().get("/archived")).text()).toContain(
			"Lisbon trip",
		);
	});

	test("signing out ends the session", async () => {
		const result = await client().action("/account", "signOut", {});
		expect(["redirect", "success"]).toContain(result.type);
		expect((await client().get("/")).headers.get("location")).toContain(
			"/auth/sign-in",
		);
	});
});
