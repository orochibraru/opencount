#!/usr/bin/env bun
//MISE description="Build the app, boot it on a seeded demo database and take the docs screenshots into docs/images"
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import {
	type BrowserContextOptions,
	chromium,
	type Page,
} from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { $, Image } from "bun";

import { ExpenseDTO, type ExpenseInput } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { GroupMemberDTO } from "#lib/dto/group-member.js";
import { GroupDTO } from "#lib/dto/group.js";
import { MerchantDTO } from "#lib/dto/merchant.js";
import { RecurringExpenseDTO } from "#lib/dto/recurring-expense.js";
import { setSetting } from "#lib/dto/setting.js";
import { configuration } from "#lib/server/core/config.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { account, user } from "#lib/server/db/schema.js";
import { splitByWeight } from "#lib/split.js";

const root = join(import.meta.dir, "..", "..");
const work = join(root, "tmp", "screenshots");
const images = join(root, "docs", "images");
const port = 4319;
const origin = `http://localhost:${port}`;
const email = "ada@opencount.example";
const password = "Showcase-Password-2026";
const secret = "screenshots-only-secret-not-for-production-use";

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
await mkdir(images, { recursive: true });

process.stdout.write("Building the app\n");
await $`bun run build`.cwd(root).quiet();

configuration.set({
	appVersion: "0.0.0",
	origin,
	databasePath: join(work, "opencount.sqlite"),
	logLevel: "warn",
	logFormat: "console",
	auth: { secret },
	worker: { concurrency: 1, pollIntervalMs: 1000 },
	telemetry: {
		otlpEndpoint: undefined,
		serviceName: "opencount",
		resourceAttributes: {},
		sentryDsn: undefined,
		sentryRelease: "0.0.0",
		sentryEnvironment: "screenshots",
	},
});
databaseConnection.migrate();

process.stdout.write("Seeding the demo\n");
const day = (offset: number) => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() - offset);
	return date.toISOString().slice(0, 10);
};

function person(id: string, name: string, role: "admin" | "member" = "member") {
	databaseConnection
		.get()
		.insert(user)
		.values({
			id,
			name,
			email: `${id}@opencount.example`,
			emailVerified: true,
			role,
		})
		.run();
	return { id, name };
}

const ada = person("ada", "Ada", "admin");
const grace = person("grace", "Grace");
const linus = person("linus", "Linus");
databaseConnection
	.get()
	.insert(account)
	.values({
		id: "ada-credential",
		accountId: ada.id,
		providerId: "credential",
		userId: ada.id,
		password: await hashPassword(password),
		createdAt: new Date(),
		updatedAt: new Date(),
	})
	.run();
setSetting("ocr", { languages: ["eng", "fra"] });

const trip = GroupDTO.create({
	name: "Lisbon trip",
	currency: "EUR",
	owner: ada,
});
const flat = GroupDTO.create({
	name: "Flat share",
	currency: "EUR",
	owner: ada,
});
GroupDTO.create({ name: "Ski weekend", currency: "CHF", owner: ada });

function membersOf(groupId: string, extra: [string, string | null][]) {
	const owner = GroupMemberDTO.forGroup(groupId)[0];
	if (!owner) {
		throw new Error("The owner should be a member");
	}
	return [
		owner,
		...extra.map(([name, userId]) => GroupMemberDTO.add(groupId, name, userId)),
	];
}

const tripMembers = membersOf(trip.id, [
	["Grace", grace.id],
	["Linus", linus.id],
	["Margaret", null],
]);
const flatMembers = membersOf(flat.id, [["Grace", grace.id]]);

function spend(
	groupId: string,
	members: GroupMemberDTO[],
	[description, merchant, category, euros, payer, offset]: [
		string,
		string | null,
		string,
		number,
		number,
		number,
	],
): ExpenseInput {
	const amountMinor = Math.round(euros * 100);
	const parts = splitByWeight(
		amountMinor,
		members.map((member) => ({ memberId: member.id, weight: 1 })),
	);
	const input: ExpenseInput = {
		kind: "expense",
		description,
		category,
		amountMinor,
		paidBy: members[payer]?.id ?? members[0]?.id ?? "",
		splitMode: "equal",
		spentOn: day(offset),
		merchantId: merchant
			? MerchantDTO.remember(groupId, merchant, category)
			: null,
		shares: members.map((member) => ({
			memberId: member.id,
			amountMinor: parts.get(member.id) ?? 0,
			weight: 1,
		})),
	};
	ExpenseDTO.create(groupId, input, ada.id);
	return input;
}

for (const entry of [
	["Flights to Lisbon", "TAP Air Portugal", "transport", 486.4, 0, 70],
	["Apartment in Alfama", "Airbnb", "lodging", 612, 1, 66],
	["Pastéis de nata", "Manteigaria", "food", 14.8, 2, 65],
	["Groceries for the flat", "Pingo Doce", "groceries", 63.25, 3, 65],
	["Tram 28 tickets", "Carris", "transport", 24, 0, 64],
	["Dinner at the harbour", "Cervejaria Ramiro", "food", 148.6, 1, 64],
	["Belém tower", null, "activities", 48, 2, 63],
	["Sunset drinks", "Park Bar", "food", 42.5, 0, 63],
	["Day trip to Sintra", "CP Comboios", "transport", 36.8, 3, 62],
	["Pena palace", null, "activities", 80, 1, 62],
	["Lunch in Sintra", "Tascantiga", "food", 71.2, 2, 62],
	["Fado night", "Clube de Fado", "activities", 120, 0, 61],
	["Souvenirs", "A Vida Portuguesa", "shopping", 54.9, 3, 60],
	["Taxi to the airport", "Bolt", "transport", 22.4, 1, 59],
] as const) {
	spend(trip.id, tripMembers, [...entry]);
}

const rent = GroupCategoryDTO.create(flat.id, "Rent", "house");
const rentInput = spend(flat.id, flatMembers, [
	"Rent",
	"Landlord",
	rent.id,
	1450,
	0,
	55,
]);
RecurringExpenseDTO.create(flat.id, rentInput, "monthly", ada.id).materialize(
	day(0),
);
const internet = spend(flat.id, flatMembers, [
	"Fibre internet",
	"Free",
	"bills",
	29.99,
	1,
	40,
]);
RecurringExpenseDTO.create(flat.id, internet, "monthly", grace.id).materialize(
	day(0),
);
for (const entry of [
	["Weekly shop", "Carrefour", "groceries", 84.3, 0, 48],
	["Weekly shop", "Carrefour", "groceries", 91.1, 1, 41],
	["Cleaning supplies", "Monoprix", "groceries", 18.6, 0, 37],
	["Weekly shop", "Carrefour", "groceries", 77.45, 1, 34],
	["Pizza night", "Deliveroo", "food", 38.9, 0, 30],
	["Electricity", "EDF", "bills", 64.2, 1, 26],
	["Weekly shop", "Carrefour", "groceries", 88, 0, 20],
	["New lamp", "IKEA", "shopping", 45, 1, 15],
	["Weekly shop", "Lidl", "groceries", 69.8, 0, 9],
	["Cinema", "UGC", "activities", 23, 1, 5],
	["Weekly shop", "Carrefour", "groceries", 82.15, 0, 2],
] as const) {
	spend(flat.id, flatMembers, [...entry]);
}
databaseConnection.close();

process.stdout.write("Starting the server\n");
const server = Bun.spawn([join(root, "build", "server")], {
	cwd: root,
	env: {
		...process.env,
		PORT: String(port),
		ORIGIN: origin,
		AUTH_SECRET: secret,
		DATABASE_PATH: join(work, "opencount.sqlite"),
		LOG_LEVEL: "warn",
	},
	stdout: "ignore",
	stderr: "inherit",
});

try {
	for (let attempt = 0; ; attempt += 1) {
		const response = await fetch(`${origin}/auth/sign-in`).catch(() => null);
		if (response?.ok) {
			break;
		}
		if (attempt > 60) {
			throw new Error("The server didn't come up");
		}
		await Bun.sleep(500);
	}

	const browser = await chromium.launch();
	const desktop: BrowserContextOptions = {
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
		reducedMotion: "reduce",
	};
	const mobile: BrowserContextOptions = {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 3,
		isMobile: true,
		hasTouch: true,
		colorScheme: "light",
		reducedMotion: "reduce",
	};

	async function signedIn(options: BrowserContextOptions): Promise<Page> {
		const context = await browser.newContext(options);
		const page = await context.newPage();
		await page.goto(`${origin}/auth/sign-in`);
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password", { exact: true }).fill(password);
		await page.getByRole("button", { name: "Sign in", exact: true }).click();
		await page.waitForURL(`${origin}/`);
		return page;
	}

	async function shoot(page: Page, name: string): Promise<void> {
		await page.waitForLoadState("networkidle");
		await page.addStyleTag({
			content: "[data-sonner-toaster] { display: none !important; }",
		});
		await Bun.sleep(400);
		const png = await page.screenshot();
		await Bun.write(
			join(images, `${name}.webp`),
			await new Image(png).webp({ quality: 90 }).bytes(),
		);
		process.stdout.write(`docs/images/${name}.webp\n`);
	}

	const tripHref = `${origin}/groups/${trip.id}`;
	const flatHref = `${origin}/groups/${flat.id}`;

	const wide = await signedIn(desktop);
	await shoot(wide, "groups-desktop");
	await wide.goto(tripHref);
	await shoot(wide, "group-desktop");
	await wide.goto(`${flatHref}/analytics?period=quarter`);
	await shoot(wide, "insights-desktop");
	await wide.goto(`${tripHref}/settings/members`);
	await shoot(wide, "settings-desktop");
	await wide.goto(`${origin}/admin/overview`);
	await shoot(wide, "admin-desktop");

	const phone = await signedIn(mobile);
	await shoot(phone, "groups-mobile");
	await phone.goto(tripHref);
	await shoot(phone, "group-mobile");
	await phone.goto(`${flatHref}/analytics?period=quarter`);
	await shoot(phone, "insights-mobile");
	await phone.goto(tripHref);
	await phone.getByRole("button", { name: "Add expense" }).last().click();
	await phone.getByLabel("What for").fill("Dinner at the harbour");
	await phone.locator("input[name=amount]").fill("86.40");
	await shoot(phone, "expense-mobile");
	await phone.locator("#expense-category").click();
	await shoot(phone, "picker-mobile");

	await browser.close();
	for (const [source, target] of [
		["group-mobile", "narrow"],
		["group-desktop", "wide"],
	]) {
		await Bun.write(
			join(root, "static", "screenshots", `${target}.webp`),
			Bun.file(join(images, `${source}.webp`)),
		);
	}
} finally {
	server.kill();
	await server.exited;
	await rm(work, { recursive: true, force: true });
}
