/** How many decimals `currency` uses (2 for EUR, 0 for JPY). */
export function currencyDigits(currency: string): number {
	try {
		return (
			new Intl.NumberFormat("en", {
				style: "currency",
				currency,
			}).resolvedOptions().maximumFractionDigits ?? 2
		);
	} catch {
		return 2;
	}
}

/** Formats an amount in minor units, like `1250` EUR as `€12.50` in the viewer's locale. */
export function formatMoney(
	minor: number,
	currency: string,
	options: { signed?: boolean } = {},
): string {
	const digits = currencyDigits(currency);
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
		signDisplay: options.signed ? "exceptZero" : "auto",
	}).format(minor / 10 ** digits);
}

/** Parses what someone typed, `12`, `12.5`, `12,50` or `1 234,56`, into minor units; `undefined` when it isn't an amount. */
export function parseMoney(
	input: string,
	currency: string,
): number | undefined {
	const cleaned = input.trim().replaceAll(/[\s'’_]/g, "");
	const match = /^(\d+)(?:[.,](\d+))?$/.exec(cleaned);
	if (!match) {
		return undefined;
	}
	const digits = currencyDigits(currency);
	const fraction = match[2] ?? "";
	if (fraction.length > digits) {
		return undefined;
	}
	return (
		Number(match[1]) * 10 ** digits +
		Number(fraction.padEnd(digits, "0") || "0")
	);
}
