import { resolve } from "$app/paths";
import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { JobDTO } from "#lib/dto/job.js";
import { Logger } from "#lib/server/core/logger.js";
import { groupAccess } from "#lib/server/expenses/group-access.js";
import {
	TricountError,
	tricountImporter,
} from "#lib/server/expenses/tricount.js";
import { parseForm } from "#lib/server/validation/form.js";
import { parseTricountForm } from "#lib/server/validation/tricount.js";
import { guessCategory } from "#lib/smart-category.js";

const logger = new Logger("Import");

const maxFileBytes = 20 * 1024 * 1024;

const linkSchema = z.object({ link: z.string().trim().default("") });

async function readSource(formData: FormData): Promise<unknown> {
	const file = formData.get("file");
	if (file instanceof File && file.size > 0) {
		if (file.size > maxFileBytes) {
			throw new TricountError("Use a file under 20 MB.");
		}
		try {
			return JSON.parse(await file.text()) as unknown;
		} catch {
			throw new TricountError("That file isn't a Tricount export.");
		}
	}
	const parsed = parseForm(linkSchema, formData);
	const key = parsed.success
		? tricountImporter.key(parsed.data.link)
		: undefined;
	if (!key) {
		throw new TricountError("Paste the Tricount's share link, or pick a file.");
	}
	try {
		return await tricountImporter.fetch(key);
	} catch (error) {
		if (error instanceof TricountError) {
			throw error;
		}
		logger.warn("Couldn't reach Tricount", error);
		throw new TricountError("Couldn't reach Tricount. Try again in a minute.");
	}
}

export const actions = {
	preview: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group } = groupAccess.forMember(params.groupId, locals.user.id);
		try {
			const preview = tricountImporter.parse(
				await readSource(await request.formData()),
			);
			if (preview.currency !== group.currency) {
				return fail(400, {
					error: `This Tricount is in ${preview.currency}. Import it into a ${preview.currency} group.`,
				});
			}
			return { preview };
		} catch (error) {
			if (error instanceof TricountError) {
				return fail(400, { error: error.message });
			}
			throw error;
		}
	},
	confirm: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: "Sign in again to continue." });
		}
		const { group, members } = groupAccess.forMember(
			params.groupId,
			locals.user.id,
		);
		const parsed = parseTricountForm(await request.formData(), {
			currency: group.currency,
			memberIds: members.map((member) => member.id),
		});
		if (!parsed.success) {
			return fail(400, { errors: parsed.errors });
		}
		const custom = GroupCategoryDTO.forGroup(group.id).map((entry) =>
			entry.toJSON(),
		);
		JobDTO.enqueue(
			"import.tricount",
			{
				groupId: group.id,
				userId: locals.user.id,
				url: resolve("/(protected)/groups/[groupId]", { groupId: group.id }),
				...parsed.data,
				expenses: parsed.data.expenses.map((entry) => {
					const guessed =
						entry.kind === "expense"
							? guessCategory(entry.description, custom)
							: undefined;
					return guessed &&
						(entry.category === "other" ||
							custom.some((category) => category.id === guessed))
						? { ...entry, category: guessed }
						: entry;
				}),
			},
			{ maxAttempts: 1 },
		);
		return { queued: parsed.data.expenses.length };
	},
};
