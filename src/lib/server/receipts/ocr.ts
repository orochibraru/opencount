import { getSetting } from "#lib/dto/setting.js";
import type { ReceiptReading } from "#lib/receipts.js";

export type RunCommand = (
	command: string[],
	input: Buffer,
) => Promise<{ exitCode: number; stdout: Buffer; stderr: string }>;

const timeoutMs = 2 * 60 * 1000;

const runWithBun: RunCommand = async (command, input) => {
	const child = Bun.spawn(command, {
		stdin: input,
		stdout: "pipe",
		stderr: "pipe",
		timeout: timeoutMs,
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout)
			.arrayBuffer()
			.then((bytes) => Buffer.from(bytes)),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { exitCode, stdout, stderr };
};

const minimumPdfTextLength = 20;

const amountPattern =
	/(-?\d{1,3}(?:[ .,'’]\d{3})*[.,]\d{2}|-?\d+[.,]\d{2})(?!\d)/g;
const totalPattern =
	/\b(total|totale|totaal|summe|gesamt|betrag|montant|a payer|à payer|net a payer|amount due|balance due|ttc|importe|to pay)\b/i;
const notItemPattern =
	/\b(sub\s?total|sous[- ]total|zwischensumme|tva|vat|tax|mwst|iva|change|rendu|cash|espèces|especes|card|carte|visa|mastercard|cb|rückgeld|tip|pourboire)\b/i;
const currencySymbols: [RegExp, string][] = [
	[/€|\bEUR\b/, "EUR"],
	[/£|\bGBP\b/, "GBP"],
	[/\bCHF\b/, "CHF"],
	[/\bUSD\b|US\$|\$/, "USD"],
	[/\bCAD\b/, "CAD"],
	[/¥|円|\bJPY\b/, "JPY"],
	[/\bSEK\b/, "SEK"],
	[/\bNOK\b/, "NOK"],
	[/\bDKK\b/, "DKK"],
	[/\bPLN\b|zł/, "PLN"],
	[/\bCZK\b|Kč/, "CZK"],
];

/** Reads receipts with the local Tesseract, and Poppler for PDFs, then parses the text into a reading. */
class ReceiptReader {
	/** Whether an admin turned receipt reading on. */
	isConfigured(): boolean {
		return getSetting("ocr") !== null;
	}

	/** Whether the `tesseract` binary is on this server's PATH. */
	isTesseractInstalled(): boolean {
		return Bun.which("tesseract") !== null;
	}

	/** Whether Poppler's `pdftotext` and `pdftoppm`, which read PDF receipts, are on this server's PATH. */
	isPopplerInstalled(): boolean {
		return Bun.which("pdftotext") !== null && Bun.which("pdftoppm") !== null;
	}

	/** The Tesseract language packs installed on this server, like `eng` or `fra`. */
	async installedLanguages(run: RunCommand = runWithBun): Promise<string[]> {
		if (!this.isTesseractInstalled()) {
			return [];
		}
		const { stdout } = await run(
			["tesseract", "--list-langs"],
			Buffer.alloc(0),
		);
		return stdout
			.toString()
			.split("\n")
			.slice(1)
			.map((line) => line.trim())
			.filter((line) => /^[a-z_]+$/.test(line) && line !== "osd");
	}

	/**
	 * Reads a receipt photo or PDF with the local Tesseract (and Poppler for PDFs) in the configured languages. The file
	 * only lives in memory for the call.
	 *
	 * @throws When receipt reading is off, a tool is missing, or it fails on the file.
	 */
	async read(
		file: Buffer,
		mimeType: string,
		run: RunCommand = runWithBun,
	): Promise<ReceiptReading> {
		const ocr = getSetting("ocr");
		if (!ocr) {
			throw new Error("Receipt reading is turned off");
		}
		if (run === runWithBun && !this.isTesseractInstalled()) {
			throw new Error("Tesseract isn't installed on this server");
		}
		if (mimeType === "application/pdf") {
			if (run === runWithBun && !this.isPopplerInstalled()) {
				throw new Error(
					"Poppler isn't installed on this server, so PDFs can't be read",
				);
			}
			return this.parseText(await this.#pdfText(file, ocr.languages, run));
		}
		return this.parseText(await this.recognizeText(file, ocr.languages, run));
	}

	/**
	 * Extracts the text of an image with Tesseract, in `languages`.
	 *
	 * @throws When Tesseract is missing, times out or fails on the image.
	 */
	async recognizeText(
		image: Buffer,
		languages: string[],
		run: RunCommand = runWithBun,
	): Promise<string> {
		const { exitCode, stdout, stderr } = await run(
			[
				"tesseract",
				"stdin",
				"stdout",
				"-l",
				languages.join("+") || "eng",
				"--psm",
				"4",
			],
			image,
		);
		if (exitCode !== 0) {
			throw new Error(
				`Tesseract failed (exit ${exitCode}): ${stderr.trim().slice(0, 200)}`,
			);
		}
		return stdout.toString();
	}

	/** Turns Tesseract's text of a receipt into a merchant, date, currency, total and line items. */
	parseText(text: string): ReceiptReading {
		const lines = text
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		const totals = lines
			.filter(
				(line) =>
					totalPattern.test(line) &&
					!/sub\s?total|sous[- ]total|zwischensumme/i.test(line),
			)
			.flatMap((line) => this.#amountsIn(line));
		const everyAmount = lines.flatMap((line) => this.#amountsIn(line));
		const total =
			totals.length > 0
				? Math.max(...totals)
				: everyAmount.length > 0
					? Math.max(...everyAmount)
					: null;
		const items = lines
			.filter((line) => !totalPattern.test(line) && !notItemPattern.test(line))
			.flatMap((line) => {
				const amounts = this.#amountsIn(line);
				const description = line
					.replace(amountPattern, "")
					.replace(/[€$£*xX]+\s*$/, "")
					.trim();
				const amountMinor = amounts.at(-1);
				return amountMinor !== undefined && /\p{L}{2,}/u.test(description)
					? [{ description: description.slice(0, 80), amountMinor }]
					: [];
			})
			.slice(0, 50);
		return {
			merchant: this.#findMerchant(lines),
			date: this.findDate(text),
			currency: this.#findCurrency(text),
			totalMinor: total,
			items,
			text: text.slice(0, 4000),
		};
	}

	/** Parses an amount like `1.234,56`, `1,234.56` or `12.50` into minor units (cents). */
	amountToMinor(raw: string): number {
		const negative = raw.startsWith("-");
		const digits = raw.replace(/^-/, "");
		const whole = digits.slice(0, -3).replace(/[^\d]/g, "") || "0";
		const fraction = digits.slice(-2);
		const value = Number(whole) * 100 + Number(fraction);
		return negative ? -value : value;
	}

	/** The first date in `text` as `YYYY-MM-DD`, reading `01/02/2026` day first unless that's impossible. */
	findDate(text: string): string | null {
		const iso = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(text);
		if (iso) {
			return this.#isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
		}
		const local = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(text);
		if (!local) {
			return null;
		}
		const first = Number(local[1]);
		const second = Number(local[2]);
		const year =
			Number(local[3]) < 100 ? 2000 + Number(local[3]) : Number(local[3]);
		return second > 12
			? this.#isoDate(year, first, second)
			: this.#isoDate(year, second, first);
	}

	/**
	 * The text of a PDF receipt: its text layer when it has one, like an emailed receipt, or else its first page
	 * rendered and read by Tesseract, like a scan. Everything goes through pipes; nothing touches the disk.
	 *
	 * @throws When Poppler or Tesseract fails on the file.
	 */
	async #pdfText(
		pdf: Buffer,
		languages: string[],
		run: RunCommand,
	): Promise<string> {
		const extracted = await run(
			["pdftotext", "-layout", "-l", "1", "-", "-"],
			pdf,
		);
		if (extracted.exitCode !== 0) {
			throw new Error(
				`pdftotext failed (exit ${extracted.exitCode}): ${extracted.stderr.trim().slice(0, 200)}`,
			);
		}
		const text = extracted.stdout.toString();
		if (text.replace(/\s/g, "").length >= minimumPdfTextLength) {
			return text;
		}
		const rendered = await run(
			[
				"pdftoppm",
				"-r",
				"300",
				"-scale-to",
				"2500",
				"-png",
				"-singlefile",
				"-f",
				"1",
				"-l",
				"1",
				"-",
			],
			pdf,
		);
		if (rendered.exitCode !== 0) {
			throw new Error(
				`pdftoppm failed (exit ${rendered.exitCode}): ${rendered.stderr.trim().slice(0, 200)}`,
			);
		}
		return this.recognizeText(rendered.stdout, languages, run);
	}

	/** Every amount on `line`, in minor units. */
	#amountsIn(line: string): number[] {
		return [...line.matchAll(amountPattern)].map((match) =>
			this.amountToMinor(match[1] ?? ""),
		);
	}

	/** `YYYY-MM-DD` for a date, or `null` when the month or day is impossible. */
	#isoDate(year: number, month: number, day: number): string | null {
		if (month < 1 || month > 12 || day < 1 || day > 31) {
			return null;
		}
		return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	}

	/** The first currency `text` names by symbol or code. */
	#findCurrency(text: string): string | null {
		return currencySymbols.find(([pattern]) => pattern.test(text))?.[1] ?? null;
	}

	/** The first line with three letters and no amount, as the merchant's name. */
	#findMerchant(lines: string[]): string | null {
		const candidate = lines.find(
			(line) =>
				(line.match(/\p{L}/gu)?.length ?? 0) >= 3 &&
				this.#amountsIn(line).length === 0,
		);
		return candidate ? candidate.replace(/\s{2,}/g, " ").slice(0, 80) : null;
	}
}

export const receiptReader = new ReceiptReader();
