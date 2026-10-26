/** A stable hue for a group's colour, derived from its name. */
export function hueOf(name: string): number {
	let hash = 0;
	for (const character of name) {
		hash = (hash * 31 + character.charCodeAt(0)) % 360;
	}
	return hash;
}
