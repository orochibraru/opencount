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
export const secondFactorAttempts = new RateLimiter(10, 15 * 60_000);
export const emailsPerRecipient = new RateLimiter(3, 15 * 60_000);
export const emailsPerClient = new RateLimiter(20, 60 * 60_000);
export const signUpCodeAttempts = new RateLimiter(15, 24 * 60 * 60_000);

/** Whether a sign-in or sign-up email may go to `recipient` for `client` now, counting it when it may. */
export function mayEmail(recipient: string, client: string): boolean {
	if (
		emailsPerRecipient.blocked(recipient) ||
		emailsPerClient.blocked(client)
	) {
		return false;
	}
	emailsPerRecipient.hit(recipient);
	emailsPerClient.hit(client);
	return true;
}
export const setupCodeAttempts = new RateLimiter(10, 60 * 60_000);
