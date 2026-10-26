import { generateKeyPair } from "node:crypto";
import { promisify } from "node:util";

import { z } from "zod";

import { currencyDigits } from "#lib/money.js";
import { expenseCategories } from "#lib/server/db/schema.js";
import { withSpan } from "#lib/server/telemetry.js";
import { guessCategory } from "#lib/smart-category.js";

export type ImportCategory = (typeof expenseCategories)[number];

export interface TricountShare {
	participant: string;
	amountMinor: number;
}

export interface TricountEntry {
	kind: "expense" | "transfer";
	description: string;
	category: ImportCategory;
	spentOn: string;
	amountMinor: number;
	original: { currency: string; amountMinor: number } | null;
	paidBy: string;
	shares: TricountShare[];
}

export interface TricountImport {
	title: string;
	currency: string;
	participants: string[];
	entries: TricountEntry[];
}

export class TricountError extends Error {}

const apiBase = "https://api.tricount.bunq.com";
const appHeaders = {
	"User-Agent": "com.bunq.tricount.android:RELEASE:7.0.7:3174:ANDROID:13:C",
	"X-Bunq-Client-Request-Id": "049bfcdf-6ae4-4cee-af7b-45da31ea85d0",
};

/** The share key in a Tricount link (`https://tricount.com/tAbCd…`) or the bare key; `undefined` when there's none. */
export function tricountKey(input: string): string | undefined {
	const trimmed = input.trim();
	const candidate = /^https?:\/\//i.test(trimmed)
		? URL.parse(trimmed)?.pathname.split("/").findLast(Boolean)
		: trimmed;
	return candidate && /^[A-Za-z0-9]{8,64}$/.test(candidate)
		? candidate
		: undefined;
}

/**
 * Fetches the Tricount shared as `key` from Tricount's API, the way its app opens a shared link: an anonymous session
 * registered with a throwaway RSA key, then the registry by its public token.
 *
 * @throws TricountError when Tricount refuses or doesn't know the link.
 */
export function fetchTricount(key: string): Promise<unknown> {
	return withSpan("tricount fetch", {}, async () => {
		const installation = crypto.randomUUID();
		const { publicKey } = await promisify(generateKeyPair)("rsa", {
			modulusLength: 2048,
			publicKeyEncoding: { type: "spki", format: "pem" },
			privateKeyEncoding: { type: "pkcs8", format: "pem" },
		});
		const headers = { ...appHeaders, "app-id": installation };
		const session = await fetch(`${apiBase}/v1/session-registry-installation`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				app_installation_uuid: installation,
				client_public_key: publicKey,
				device_description: "Android",
			}),
			signal: AbortSignal.timeout(15_000),
		});
		if (!session.ok) {
			throw new TricountError("Tricount didn't answer. Try again in a minute.");
		}
		const items = ((await session.json()) as { Response?: unknown[] })
			.Response as
			{ Token?: { token: string }; UserPerson?: { id: number } }[] | undefined;
		const token = items?.find((item) => item.Token)?.Token?.token;
		const userId = items?.find((item) => item.UserPerson)?.UserPerson?.id;
		if (!token || userId === undefined) {
			throw new TricountError("Tricount didn't answer. Try again in a minute.");
		}
		const registry = await fetch(
			`${apiBase}/v1/user/${userId}/registry?public_identifier_token=${encodeURIComponent(key)}`,
			{
				headers: { ...headers, "X-Bunq-Client-Authentication": token },
				signal: AbortSignal.timeout(15_000),
			},
		);
		if (!registry.ok) {
			throw new TricountError("Tricount doesn't know that link.");
		}
		return registry.json();
	});
}

const membershipSchema = z.record(
	z.string(),
	z.looseObject({ alias: z.looseObject({ display_name: z.string() }) }),
);
const amountSchema = z.looseObject({ value: z.string(), currency: z.string() });
const entrySchema = z.looseObject({
	description: z.string().nullish(),
	date: z.string(),
	type_transaction: z.string().nullish(),
	category: z.string().nullish(),
	category_custom: z.string().nullish(),
	status: z.string().nullish(),
	amount: amountSchema,
	amount_local: amountSchema.nullish(),
	membership_owned: membershipSchema,
	allocations: z.array(
		z.looseObject({ membership: membershipSchema, amount: amountSchema }),
	),
});
const registrySchema = z.looseObject({
	Response: z.array(
		z.looseObject({
			Registry: z
				.looseObject({
					title: z.string().nullish(),
					currency: z.string().nullish(),
					memberships: z.array(membershipSchema),
					all_registry_entry: z.array(
						z.looseObject({ RegistryEntry: entrySchema }),
					),
				})
				.optional(),
		}),
	),
});

const categoryPatterns: [RegExp, ImportCategory][] = [
	[/pet|animal/i, "pets"],
	[/health|medical|pharma|doctor/i, "health"],
	[/diy|furniture|garden|home|house(?!hold)/i, "home"],
	[/subscription|streaming/i, "subscriptions"],
	[/beauty|hair|personal care/i, "care"],
	[/book|music|concert|theat|culture/i, "culture"],
	[/education|school/i, "education"],
	[/grocer|supermarket/i, "groceries"],
	[/food|restaurant|drink|bar|meal|dinner|lunch|breakfast/i, "food"],
	[/transport|travel|car|fuel|gas|taxi|train|flight|parking/i, "transport"],
	[/accommodation|lodging|hotel|rent|housing/i, "lodging"],
	[
		/entertainment|activity|activities|leisure|sport|culture|ticket/i,
		"activities",
	],
	[/shopping|gift|cloth/i, "shopping"],
	[/bill|utilit|insurance/i, "bills"],
];

/**
 * The built-in category closest to a Tricount category, custom category name or description: Tricount's own names
 * first, then the keywords OpenCount guesses from; Other when nothing matches.
 */
export function importCategory(
	...names: (string | null | undefined)[]
): ImportCategory {
	for (const name of names) {
		const match = categoryPatterns.find(([pattern]) =>
			pattern.test(name ?? ""),
		);
		if (match) {
			return match[1];
		}
	}
	const guessed = names
		.map((name) => guessCategory(name ?? ""))
		.find((category) => category !== undefined);
	return expenseCategories.find((category) => category === guessed) ?? "other";
}

function memberName(wrapper: z.infer<typeof membershipSchema>): string {
	return Object.values(wrapper)[0]?.alias.display_name.trim() || "?";
}

function toMinor(value: string, currency: string): number {
	const parsed = Math.abs(Number(value));
	return Number.isFinite(parsed)
		? Math.round(parsed * 10 ** currencyDigits(currency))
		: 0;
}

type RegistryEntry = z.infer<typeof entrySchema>;

const reimbursement =
	/^(re?imbursement|remboursement|rembourse|virement|transfer|repayment|payback|reembolso|rimborso|erstattung|terugbetaling)\b/i;

function sharesOf(
	entry: RegistryEntry,
	currency: string,
	amountMinor: number,
): TricountShare[] | undefined {
	const shares = entry.allocations
		.map((allocation) => ({
			participant: memberName(allocation.membership),
			amountMinor: toMinor(allocation.amount.value, currency),
		}))
		.filter((share) => share.amountMinor > 0);
	const [first] = shares;
	if (!first) {
		return undefined;
	}
	first.amountMinor +=
		amountMinor - shares.reduce((total, share) => total + share.amountMinor, 0);
	return first.amountMinor > 0 ? shares : undefined;
}

function originalOf(
	entry: RegistryEntry,
	currency: string,
): TricountEntry["original"] {
	const local = entry.amount_local;
	if (!local || local.currency === currency) {
		return null;
	}
	const amountMinor = toMinor(local.value, local.currency);
	return amountMinor > 0 ? { currency: local.currency, amountMinor } : null;
}

function entriesOf(entry: RegistryEntry, currency: string): TricountEntry[] {
	const amountMinor = toMinor(entry.amount.value, currency);
	const spentOn = entry.date.slice(0, 10);
	const shares =
		entry.status === "DELETED" ||
		amountMinor === 0 ||
		!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)
			? undefined
			: sharesOf(entry, currency, amountMinor);
	if (!shares) {
		return [];
	}
	const paidBy = memberName(entry.membership_owned);
	const description = (entry.description?.trim() || "Expense").slice(0, 120);
	if (entry.type_transaction === "INCOME") {
		return shares
			.filter((share) => share.participant !== paidBy)
			.map((share) => ({
				kind: "transfer",
				description,
				category: "other",
				spentOn,
				amountMinor: share.amountMinor,
				original: null,
				paidBy: share.participant,
				shares: [{ participant: paidBy, amountMinor: share.amountMinor }],
			}));
	}
	const transfer =
		entry.type_transaction === "BALANCE" ||
		reimbursement.test(entry.description?.trim() ?? "");
	return [
		{
			kind: transfer ? "transfer" : "expense",
			description:
				transfer && !entry.description?.trim() ? "Payment" : description,
			category: transfer
				? "other"
				: importCategory(entry.category_custom, entry.category, description),
			spentOn,
			amountMinor,
			original: originalOf(entry, currency),
			paidBy,
			shares,
		},
	];
}

/**
 * Reads a Tricount registry, as its API returns it, into expenses and transfers in its currency: shares adjusted to
 * add up to each total, incomes turned into a transfer from each person they were for to whoever received them,
 * entries described as a reimbursement turned into a payment, and amounts entered in another currency kept as the
 * original.
 *
 * @throws TricountError when `raw` isn't a Tricount registry or holds nothing to import.
 */
export function parseTricount(raw: unknown): TricountImport {
	const parsed = registrySchema.safeParse(raw);
	const registry = parsed.success
		? parsed.data.Response.find((item) => item.Registry)?.Registry
		: undefined;
	if (!registry) {
		throw new TricountError("That isn't a Tricount.");
	}
	const currency =
		registry.currency ??
		registry.all_registry_entry[0]?.RegistryEntry.amount.currency ??
		"EUR";
	const participants = new Set(registry.memberships.map(memberName));
	const entries = registry.all_registry_entry.flatMap(({ RegistryEntry }) =>
		entriesOf(RegistryEntry, currency),
	);
	for (const entry of entries) {
		for (const name of [
			entry.paidBy,
			...entry.shares.map((share) => share.participant),
		]) {
			participants.add(name);
		}
	}
	if (entries.length === 0) {
		throw new TricountError("That Tricount has no expenses to import.");
	}
	return {
		title: registry.title?.trim() || "Tricount",
		currency,
		participants: [...participants],
		entries,
	};
}
