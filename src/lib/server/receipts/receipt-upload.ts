import { type ReceiptReading, receiptTypes } from "#lib/receipts.js";
import { Logger } from "#lib/server/core/logger.js";
import { receiptReader } from "#lib/server/receipts/ocr.js";

const logger = new Logger("Receipts");

const maxBytes = 10 * 1024 * 1024;

/** Runs one task at a time, in arrival order, so heavy work can't pile up in memory. */
class OneAtATime {
	#tail: Promise<unknown> = Promise.resolve();

	/** Runs `task` once every task queued before it settled; settles like `task`. */
	run<Result>(task: () => Promise<Result>): Promise<Result> {
		const next = this.#tail.then(task, task);
		this.#tail = next.catch(() => undefined);
		return next;
	}
}

/** Reads uploaded receipts one at a time, keeping each file in memory only for its scan. */
class ReceiptUpload {
	readonly #scans = new OneAtATime();

	/**
	 * Reads the receipt uploaded as `receipt` in `formData` and forgets it: the file is never stored, only the reading
	 * goes back to the caller.
	 */
	async read(
		formData: FormData,
	): Promise<{ reading: ReceiptReading } | { error: string }> {
		const file = formData.get("receipt");
		if (!(file instanceof File) || file.size === 0) {
			return { error: "Pick a photo or a PDF of a receipt." };
		}
		if (!receiptTypes.includes(file.type) || file.size > maxBytes) {
			return { error: "Use a JPEG, PNG, WebP or PDF under 10 MB." };
		}
		try {
			return {
				reading: await this.#scans.run(async () =>
					receiptReader.read(Buffer.from(await file.arrayBuffer()), file.type),
				),
			};
		} catch (error) {
			logger.warn("Couldn't read a receipt", { type: file.type }, error);
			return {
				error: "Couldn't read that receipt. Try a sharper, flatter photo.",
			};
		}
	}
}

export const receiptUpload = new ReceiptUpload();
