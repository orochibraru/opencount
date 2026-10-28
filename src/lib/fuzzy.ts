/** `text` as lower-case words without accents or punctuation. */
function wordsOf(text: string): string[] {
	return text
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
}

/** How many single-letter edits turn `left` into `right`. */
function editDistance(left: string, right: string): number {
	let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
	for (let row = 1; row <= left.length; row += 1) {
		const current = [row];
		for (let column = 1; column <= right.length; column += 1) {
			current[column] = Math.min(
				(previous[column] ?? 0) + 1,
				(current[column - 1] ?? 0) + 1,
				(previous[column - 1] ?? 0) +
					(left[row - 1] === right[column - 1] ? 0 : 1),
			);
		}
		previous = current;
	}
	return previous[right.length] ?? 0;
}

/**
 * Whether `text` matches the search `query`: every word of the query, whatever its case or accents, is in the text,
 * as a part of it, run together ("leroymerlin") or one typo away from the start of one of its words (two for long
 * words). A query of only punctuation matches as typed; an empty one matches everything.
 */
export function fuzzyMatches(text: string, query: string): boolean {
	const tokens = wordsOf(query);
	if (tokens.length === 0) {
		return text.toLowerCase().includes(query.trim().toLowerCase());
	}
	const words = wordsOf(text);
	const joined = words.join(" ");
	const compact = words.join("");
	return tokens.every((token) => {
		if (joined.includes(token) || compact.includes(token)) {
			return true;
		}
		if (token.length < 4) {
			return false;
		}
		const allowed = token.length >= 8 ? 2 : 1;
		return words.some(
			(word) =>
				editDistance(token, word.slice(0, token.length)) <= allowed ||
				editDistance(token, word) <= allowed,
		);
	});
}
