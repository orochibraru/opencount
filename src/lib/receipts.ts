/** The receipt files the scanner reads: photos, and PDFs from a mailbox or a scanner. */
export const receiptTypes = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"application/pdf",
];

/** What the scanner made of a receipt. */
export interface ReceiptReading {
	merchant: string | null;
	date: string | null;
	currency: string | null;
	totalMinor: number | null;
	items: { description: string; amountMinor: number }[];
	text: string;
}
