import { similarKey } from "#lib/similar-key.js";

/** Whether a rule looking for `pattern` matches a line described `description`, ignoring case, accents and plurals. */
export function ruleMatches(pattern: string, description: string): boolean {
	const wanted = similarKey(pattern);
	return wanted !== "" && similarKey(description).includes(wanted);
}
