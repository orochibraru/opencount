import type { Category, CustomCategory } from "#lib/categories.js";
import categoryKeywords from "#lib/category-keywords.json";

const keywords = Object.entries(categoryKeywords) as [Category, string[]][];

function normalise(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

const rules = keywords.map(
	([category, words]) =>
		[
			category,
			new RegExp(`(^|[^a-z0-9])(${words.join("|")})(s|x|es)?($|[^a-z0-9])`),
		] as const,
);

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The category an expense called `text` most likely belongs to: one of `custom` whose name it mentions, or else a
 * built-in one from keywords in English, French, German, Spanish, Italian, Dutch and Portuguese, plurals included.
 */
export function guessCategory(
	text: string,
	custom: CustomCategory[] = [],
): string | undefined {
	const normalised = normalise(text);
	const own = custom.find((category) => {
		const name = normalise(category.name).trim();
		return (
			name !== "" &&
			new RegExp(`(^|[^a-z0-9])${escape(name)}($|[^a-z0-9])`).test(normalised)
		);
	});
	return own?.id ?? rules.find(([, pattern]) => pattern.test(normalised))?.[0];
}
