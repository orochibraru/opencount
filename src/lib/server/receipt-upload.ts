import { type ReceiptReading, receiptTypes } from "#lib/receipts.js";
import { Logger } from "#lib/server/logger.js";
import { readReceipt } from "#lib/server/ocr.js";

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

const scans = new OneAtATime();

/**
 * Reads the receipt uploaded as `receipt` in `formData` and forgets it: the file is never stored, only the reading
 * goes back to the caller.
 */
export async function readUploadedReceipt(
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
			reading: await scans.run(async () =>
				readReceipt(Buffer.from(await file.arrayBuffer()), file.type),
			),
		};
	} catch (error) {
		logger.warn("Couldn't read a receipt", { type: file.type }, error);
		return {
			error: "Couldn't read that receipt. Try a sharper, flatter photo.",
		};
	}
}
