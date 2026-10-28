import { Logger } from "#lib/server/core/logger.js";
import { telemetry } from "#lib/server/core/telemetry.js";

const logger = new Logger("ExchangeRates");

/** The European Central Bank's rates through Frankfurter, remembered for the life of the process. */
class ExchangeRates {
	readonly #cache = new Map<string, number>();

	/**
	 * The rate from `from` to `to` on `date` (or the last business day before it); `undefined` when the service can't
	 * answer.
	 */
	async rate(
		from: string,
		to: string,
		date: string,
	): Promise<number | undefined> {
		const key = `${from}:${to}:${date}`;
		const cached = this.#cache.get(key);
		if (cached !== undefined) {
			return cached;
		}
		try {
			const rate = await telemetry.withSpan(
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
				this.#cache.set(key, rate);
			}
			return rate;
		} catch (error) {
			logger.warn("Couldn't fetch an exchange rate", { from, to, date }, error);
			return undefined;
		}
	}
}

export const exchangeRates = new ExchangeRates();
