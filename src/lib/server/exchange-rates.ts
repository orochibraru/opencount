import { Logger } from "#lib/server/logger.js";
import { withSpan } from "#lib/server/telemetry.js";

const logger = new Logger("ExchangeRates");

const cache = new Map<string, number>();

/**
 * The European Central Bank's rate from `from` to `to` on `date` (or the last business day before it), through
 * Frankfurter, remembered for the life of the process; `undefined` when the service can't answer.
 */
export async function exchangeRate(
	from: string,
	to: string,
	date: string,
): Promise<number | undefined> {
	const key = `${from}:${to}:${date}`;
	const cached = cache.get(key);
	if (cached !== undefined) {
		return cached;
	}
	try {
		const rate = await withSpan(
			"exchange rate",
			{ "rate.from": from, "rate.to": to },
			async () => {
				const response = await fetch(
					`https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=${to}`,
					{ signal: AbortSignal.timeout(5000) },
				);
				if (!response.ok) {
					throw new Error(`Frankfurter answered ${response.status}`);
				}
				const body = (await response.json()) as {
					rates?: Record<string, number>;
				};
				return body.rates?.[to];
			},
		);
		if (rate !== undefined) {
			cache.set(key, rate);
		}
		return rate;
	} catch (error) {
		logger.warn("Couldn't fetch an exchange rate", { from, to, date }, error);
		return undefined;
	}
}
