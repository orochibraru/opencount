/** Counts attempts per key over a sliding window, in memory, to slow down guessing. */
export class RateLimiter {
	readonly #limit: number;
	readonly #windowMs: number;
	readonly #attempts = new Map<string, number[]>();

	constructor(limit: number, windowMs: number) {
		this.#limit = limit;
		this.#windowMs = windowMs;
	}

	/** Whether `key` used up its attempts in the current window. */
	blocked(key: string, now = Date.now()): boolean {
		return this.#recent(key, now).length >= this.#limit;
	}

	/** Records an attempt for `key`, and forgets keys gone quiet once too many pile up. */
	hit(key: string, now = Date.now()): void {
		this.#attempts.set(key, [...this.#recent(key, now), now]);
		if (this.#attempts.size > 50_000) {
			for (const [stale] of [...this.#attempts].filter(
				([, times]) => (times.at(-1) ?? 0) <= now - this.#windowMs,
			)) {
				this.#attempts.delete(stale);
			}
		}
	}

	/** Forgets `key`'s attempts, after it proved itself. */
	reset(key: string): void {
		this.#attempts.delete(key);
	}

	/** `key`'s attempts still inside the window. */
	#recent(key: string, now: number): number[] {
		return (this.#attempts.get(key) ?? []).filter(
			(time) => time > now - this.#windowMs,
		);
	}
}

export const passwordAttempts = new RateLimiter(10, 15 * 60_000);
export const addressAttempts = new RateLimiter(50, 15 * 60_000);
export const resetRequests = new RateLimiter(3, 60 * 60_000);
