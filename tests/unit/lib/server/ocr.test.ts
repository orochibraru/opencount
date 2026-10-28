import { beforeEach, describe, expect, spyOn, test } from "bun:test";

import { setSetting } from "#lib/dto/setting.js";
import { receiptReader, type RunCommand } from "#lib/server/receipts/ocr.js";
import { receiptUpload } from "#lib/server/receipts/receipt-upload.js";

import { resetDatabase } from "../../database.js";

const receipt = `BOULANGERIE DU PORT
12 rue de la Mer, 13002 Marseille
Le 03/10/2026 à 08:42

Baguette tradition      1,30
Croissant x2            2,60
Café allongé            2,10
SOUS-TOTAL              6,00
TVA 5,5%                0,31
TOTAL TTC EUR           6,00
CB                      6,00
`;

function fakeRun(
	stdout: string,
	exitCode = 0,
): { run: RunCommand; calls: string[][] } {
	return scriptedRun({ "*": { stdout, exitCode } });
}

/** A fake runner answering per binary name, with `*` as the fallback. */
function scriptedRun(
	answers: Record<string, { stdout: string; exitCode?: number }>,
): { run: RunCommand; calls: string[][] } {
	const calls: string[][] = [];
	const run: RunCommand = async (command) => {
		calls.push(command);
		const answer = answers[command[0] ?? ""] ?? answers["*"];
		const exitCode = answer?.exitCode ?? 0;
		return {
			exitCode,
			stdout: Buffer.from(answer?.stdout ?? ""),
			stderr: exitCode === 0 ? "" : "Error in pixReadStream",
		};
	};
	return { run, calls };
}

describe("receipt text parsing", () => {
	test("reads merchant, date, currency, total and lines from a French receipt", () => {
		const reading = receiptReader.parseText(receipt);
		expect(reading).toMatchObject({
			merchant: "BOULANGERIE DU PORT",
			date: "2026-10-03",
			currency: "EUR",
			totalMinor: 600,
		});
		expect(reading.items).toEqual([
			{ description: "Baguette tradition", amountMinor: 130 },
			{ description: "Croissant x2", amountMinor: 260 },
			{ description: "Café allongé", amountMinor: 210 },
		]);
	});

	test("falls back to the largest amount, and handles thousands separators", () => {
		expect(
			receiptReader.parseText("Shop\nThing 1,234.56\nOther 3.00").totalMinor,
		).toBe(123_456);
		expect(receiptReader.parseText("nothing readable").totalMinor).toBeNull();
		expect(receiptReader.amountToMinor("1.234,56")).toBe(123_456);
		expect(receiptReader.amountToMinor("-2,50")).toBe(-250);
	});

	test("dates are ISO, day first unless that's impossible", () => {
		expect(receiptReader.findDate("2026-10-03 12:00")).toBe("2026-10-03");
		expect(receiptReader.findDate("01/02/26")).toBe("2026-02-01");
		expect(receiptReader.findDate("12/25/2026")).toBe("2026-12-25");
		expect(receiptReader.findDate("13/13/2026")).toBeNull();
		expect(receiptReader.findDate("no date")).toBeNull();
	});
});

describe("tesseract", () => {
	beforeEach(resetDatabase);

	test("calls tesseract with the configured languages and reports failures", async () => {
		const { run, calls } = fakeRun(receipt);
		expect(
			await receiptReader.recognizeText(
				Buffer.from("img"),
				["eng", "fra"],
				run,
			),
		).toBe(receipt);
		expect(calls[0]).toEqual([
			"tesseract",
			"stdin",
			"stdout",
			"-l",
			"eng+fra",
			"--psm",
			"4",
		]);
		expect(
			receiptReader.recognizeText(Buffer.from("img"), [], fakeRun("", 1).run),
		).rejects.toThrow("Tesseract failed (exit 1)");
	});

	test("readReceipt needs receipt reading turned on", async () => {
		const { run } = fakeRun(receipt);
		expect(receiptReader.isConfigured()).toBe(false);
		expect(
			receiptReader.read(Buffer.from("img"), "image/png", run),
		).rejects.toThrow("turned off");
		setSetting("ocr", { languages: ["fra"] });
		expect(
			(await receiptReader.read(Buffer.from("img"), "image/png", run))
				.totalMinor,
		).toBe(600);
	});

	test("reads a PDF's text layer without OCR", async () => {
		setSetting("ocr", { languages: ["fra"] });
		const { run, calls } = scriptedRun({ pdftotext: { stdout: receipt } });
		const reading = await receiptReader.read(
			Buffer.from("%PDF"),
			"application/pdf",
			run,
		);
		expect(reading.totalMinor).toBe(600);
		expect(calls.map((command) => command[0])).toEqual(["pdftotext"]);
	});

	test("renders and OCRs a scanned PDF with no text layer", async () => {
		setSetting("ocr", { languages: ["fra"] });
		const { run, calls } = scriptedRun({
			pdftotext: { stdout: "\f" },
			pdftoppm: { stdout: "png" },
			tesseract: { stdout: receipt },
		});
		const reading = await receiptReader.read(
			Buffer.from("%PDF"),
			"application/pdf",
			run,
		);
		expect(reading.merchant).toBe("BOULANGERIE DU PORT");
		expect(calls.map((command) => command[0])).toEqual([
			"pdftotext",
			"pdftoppm",
			"tesseract",
		]);
	});

	test("reports Poppler failures", async () => {
		setSetting("ocr", { languages: ["fra"] });
		expect(
			receiptReader.read(
				Buffer.from("%PDF"),
				"application/pdf",
				scriptedRun({ pdftotext: { stdout: "", exitCode: 1 } }).run,
			),
		).rejects.toThrow("pdftotext failed");
		expect(
			receiptReader.read(
				Buffer.from("%PDF"),
				"application/pdf",
				scriptedRun({
					pdftotext: { stdout: "" },
					pdftoppm: { stdout: "", exitCode: 99 },
				}).run,
			),
		).rejects.toThrow("pdftoppm failed");
	});

	test("lists installed languages without the orientation pack", async () => {
		const which = spyOn(Bun, "which").mockReturnValue("/usr/bin/tesseract");
		const { run } = fakeRun(
			'List of available languages in "/usr/share/tessdata/" (3):\neng\nfra\nosd\n',
		);
		expect(receiptReader.isTesseractInstalled()).toBe(true);
		expect(await receiptReader.installedLanguages(run)).toEqual(["eng", "fra"]);
		which.mockReturnValue(null);
		expect(await receiptReader.installedLanguages(run)).toEqual([]);
		which.mockRestore();
	});

	test("reports whether Poppler is installed", () => {
		const which = spyOn(Bun, "which").mockReturnValue("/usr/bin/pdftoppm");
		expect(receiptReader.isPopplerInstalled()).toBe(true);
		which.mockReturnValue(null);
		expect(receiptReader.isPopplerInstalled()).toBe(false);
		which.mockRestore();
	});
});

describe("uploaded receipts", () => {
	beforeEach(resetDatabase);

	function upload(file?: File): FormData {
		const formData = new FormData();
		if (file) {
			formData.set("receipt", file);
		}
		return formData;
	}

	test("rejects a missing, wrong or oversized file", async () => {
		expect(await receiptUpload.read(upload())).toEqual({
			error: "Pick a photo or a PDF of a receipt.",
		});
		expect(
			await receiptUpload.read(
				upload(new File(["x"], "a.gif", { type: "image/gif" })),
			),
		).toEqual({ error: "Use a JPEG, PNG, WebP or PDF under 10 MB." });
		expect(
			await receiptUpload.read(
				upload(
					new File([new Uint8Array(11 * 1024 * 1024)], "a.png", {
						type: "image/png",
					}),
				),
			),
		).toEqual({ error: "Use a JPEG, PNG, WebP or PDF under 10 MB." });
	});

	test("turns a read failure into a plain message", async () => {
		setSetting("ocr", { languages: ["eng"] });
		const which = spyOn(Bun, "which").mockReturnValue(null);
		expect(
			await receiptUpload.read(
				upload(new File(["x"], "a.png", { type: "image/png" })),
			),
		).toEqual({
			error: "Couldn't read that receipt. Try a sharper, flatter photo.",
		});
		which.mockRestore();
	});
});
