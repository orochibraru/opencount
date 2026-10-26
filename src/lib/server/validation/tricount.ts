import { z } from "zod";

import type { ExpenseInput } from "#lib/dto/expense.js";
import { currencyDigits } from "#lib/money.js";
import { expenseCategories, expenseKinds } from "#lib/server/db/schema.js";
import type { ParsedForm } from "#lib/server/validation/form.js";
import { parseForm } from "#lib/server/validation/form.js";

const positiveMinor = z.number().int().positive();
const nameSchema = z.string().min(1).max(200);

const importSchema = z.object({
	title: z.string().max(200),
	currency: z.string(),
	participants: z.array(nameSchema).min(1).max(500),
	entries: z
		.array(
			z
				.object({
					kind: z.enum(expenseKinds),
					description: z.string().trim().min(1).max(120),
					category: z.enum(expenseCategories),
					spentOn: z.iso.date(),
					amountMinor: positiveMinor,
					original: z
						.object({
							currency: z.string().regex(/^[A-Z]{3}$/),
							amountMinor: positiveMinor,
						})
						.nullable(),
					paidBy: nameSchema,
					shares: z
						.array(
							z.object({ participant: nameSchema, amountMinor: positiveMinor }),
						)
						.min(1),
				})
				.refine(
					(entry) =>
						entry.shares.reduce(
							(total, share) => total + share.amountMinor,
							0,
						) === entry.amountMinor,
				),
		)
		.min(1)
		.max(20_000),
});

const formSchema = z.object({
	data: z
		.string()
		.transform((value, context) => {
			try {
				return JSON.parse(value) as unknown;
			} catch {
				context.addIssue({
					code: "custom",
					message: "Preview the import again.",
				});
				return z.NEVER;
			}
		})
		.pipe(importSchema),
});

export interface TricountImportForm {
	title: string;
	newMembers: Record<string, string>;
	expenses: ExpenseInput[];
}

/**
 * Validates a previewed Tricount sent back with who each of its people is in the group (`map:<index>`, a member id or
 * `new`) and turns it into the group's expenses: shares of people mapped to one member merged, payments to oneself
 * dropped. People added as new members get a placeholder id `new:<index>`.
 */
export function parseTricountForm(
	formData: FormData,
	{ currency, memberIds }: { currency: string; memberIds: string[] },
): ParsedForm<TricountImportForm> {
	const parsed = parseForm(formSchema, formData);
	if (!parsed.success) {
		return parsed;
	}
	const data = parsed.data.data;
	if (data.currency !== currency) {
		return {
			success: false,
			errors: {
				form: [
					`This Tricount is in ${data.currency}, the group in ${currency}.`,
				],
			},
		};
	}
	const newMembers: Record<string, string> = {};
	const members = new Map<string, string>();
	for (const [index, participant] of data.participants.entries()) {
		const choice = String(formData.get(`map:${index}`) ?? "new");
		if (choice === "new") {
			newMembers[`new:${index}`] = participant.slice(0, 60);
			members.set(participant, `new:${index}`);
		} else if (memberIds.includes(choice)) {
			members.set(participant, choice);
		} else {
			return {
				success: false,
				errors: { form: [`Pick who ${participant} is in the group.`] },
			};
		}
	}
	const expenses: ExpenseInput[] = [];
	for (const entry of data.entries) {
		const paidBy = members.get(entry.paidBy);
		const shares = new Map<string, number>();
		for (const share of entry.shares) {
			const memberId = members.get(share.participant);
			if (!memberId || !paidBy) {
				return {
					success: false,
					errors: { form: ["Preview the import again."] },
				};
			}
			shares.set(memberId, (shares.get(memberId) ?? 0) + share.amountMinor);
		}
		if (
			!paidBy ||
			(entry.kind === "transfer" &&
				[...shares.keys()].every((id) => id === paidBy))
		) {
			continue;
		}
		expenses.push({
			kind: entry.kind,
			description: entry.description,
			category: entry.category,
			amountMinor: entry.amountMinor,
			...(entry.original && {
				originalCurrency: entry.original.currency,
				originalAmountMinor: entry.original.amountMinor,
				exchangeRate:
					entry.amountMinor /
					10 ** currencyDigits(currency) /
					(entry.original.amountMinor /
						10 ** currencyDigits(entry.original.currency)),
			}),
			paidBy,
			splitMode: "exact",
			spentOn: entry.spentOn,
			merchantId: null,
			shares: [...shares].map(([memberId, amountMinor]) => ({
				memberId,
				amountMinor,
				weight: 1,
			})),
		});
	}
	return {
		success: true,
		data: { title: data.title, newMembers, expenses },
	};
}
