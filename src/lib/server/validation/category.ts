import { z } from "zod";

import {
	categories,
	type CustomCategory,
	customCategoryIcons,
} from "#lib/categories.js";

export const categorySchema = z.object({
	id: z.string().optional(),
	name: z
		.string()
		.trim()
		.min(1, "Give it a name.")
		.max(40, "Keep it under 40 characters."),
	icon: z
		.string()
		.refine((icon) => icon in customCategoryIcons, "Pick an icon."),
});

/** Whether `name` repeats a built-in category or one of `custom` other than `exceptId`, whatever its case. */
export function categoryNameTaken(
	custom: CustomCategory[],
	name: string,
	exceptId?: string,
): boolean {
	const wanted = name.toLocaleLowerCase();
	return (
		categories.some((entry) => entry.label.toLocaleLowerCase() === wanted) ||
		custom.some(
			(entry) =>
				entry.id !== exceptId && entry.name.toLocaleLowerCase() === wanted,
		)
	);
}
