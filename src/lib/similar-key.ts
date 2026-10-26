/**
 * What makes two descriptions the same thing despite spelling: lower case, no accents or punctuation, one-letter words
 * dropped and a plural or possessive "s" taken off longer words, so "Sergio", "Sergios" and "Sergio's" all match.
 */
export function similarKey(text: string): string {
	return text
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, " ")
		.split(" ")
		.filter((word) => word.length > 1)
		.map((word) => (word.length > 3 ? word.replace(/[sx]$/, "") : word))
		.join(" ");
}
