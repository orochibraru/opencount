import { type ReceiptReading, receiptTypes } from "#lib/receipts.js";
import { Logger } from "#lib/server/logger.js";
import { readReceipt } from "#lib/server/ocr.js";

const logger = new Logger("Receipts");

const maxBytes = 10 * 1024 * 1024;

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
			reading: await readReceipt(
				Buffer.from(await file.arrayBuffer()),
				file.type,
			),
		};
	} catch (error) {
		logger.warn("Couldn't read a receipt", { type: file.type }, error);
		return {
			error: "Couldn't read that receipt. Try a sharper, flatter photo.",
		};
	}
}
