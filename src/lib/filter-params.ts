/** The values of the repeated search param `name` in `url` that are among `known`, each once, in the order of `known`. */
export function knownValues(
	url: URL,
	name: string,
	known: Iterable<string>,
): string[] {
	const wanted = new Set(url.searchParams.getAll(name));
	return [...new Set(known)].filter((value) => wanted.has(value));
}

/** `values` with `value` added, or without it when it is already there. */
export function toggled(values: string[], value: string): string[] {
	return values.includes(value)
		? values.filter((entry) => entry !== value)
		: [...values, value];
}

/** Adds each of `values` to `params` under the repeated name `name`. */
export function appendAll(
	params: URLSearchParams,
	name: string,
	values: string[],
): void {
	for (const value of values) {
		params.append(name, value);
	}
}

/** Bank and account filter values (`bank:<id>`, `account:<uid>`) made from the selected `bankIds` and `accountUids`. */
export function sourceValues(
	bankIds: string[],
	accountUids: string[],
): string[] {
	return [
		...bankIds.map((id) => `bank:${id}`),
		...accountUids.map((uid) => `account:${uid}`),
	];
}

/** Adds the bank and account filter values in `sources` to `params` as `bank` and `account` params. */
export function appendSources(
	params: URLSearchParams,
	sources: string[],
): void {
	for (const source of sources) {
		if (source.startsWith("bank:")) {
			params.append("bank", source.slice(5));
		} else if (source.startsWith("account:")) {
			params.append("account", source.slice(8));
		}
	}
}

/** `labels` read as alternatives: "A", "A or B", "A, B or C". */
export function alternatives(labels: string[]): string {
	return labels.length < 2
		? (labels[0] ?? "")
		: `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}`;
}
