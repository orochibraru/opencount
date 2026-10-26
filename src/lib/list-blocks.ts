export interface ListBlock<Entry> {
	key: string;
	group: string;
	entries: Entry[];
	heading: boolean;
	loadedFromHere: boolean;
}

/**
 * Groups `entries`, already sorted, into consecutive blocks by `groupOf`, splitting a block where entry `leftOff`
 * begins so a separator can show where newly loaded entries start; only the first block of a group gets a heading.
 */
export function listBlocks<Entry>(
	entries: Entry[],
	groupOf: (entry: Entry) => string,
	leftOff?: number,
): ListBlock<Entry>[] {
	const blocks: ListBlock<Entry>[] = [];
	for (const [index, entry] of entries.entries()) {
		const group = groupOf(entry);
		const last = blocks.at(-1);
		const loadedFromHere = index > 0 && index === leftOff;
		if (last && last.group === group && !loadedFromHere) {
			last.entries.push(entry);
		} else {
			blocks.push({
				key: `${group}:${index}`,
				group,
				entries: [entry],
				heading: last?.group !== group,
				loadedFromHere,
			});
		}
	}
	return blocks;
}
