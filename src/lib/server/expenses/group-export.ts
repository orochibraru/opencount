import { join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";

import { computeBalances, settleUp } from "#lib/balances.js";
import { categoryLabels } from "#lib/category-labels.js";
import { ExpenseDTO, type ExpenseRow } from "#lib/dto/expense.js";
import { GroupCategoryDTO } from "#lib/dto/group-category.js";
import { GroupMemberDTO, type GroupMemberRow } from "#lib/dto/group-member.js";
import { formatMoney, minorToDecimal } from "#lib/money.js";

export interface GroupExportSource {
	name: string;
	currency: string;
	members: GroupMemberRow[];
	expenses: ExpenseRow[];
	categoryNames: Map<string, string>;
}

interface EmbeddedFont {
	font: PDFFont;
	characters: Set<number>;
}

const pageSize: [number, number] = [595.28, 841.89];
const margin = 48;
const muted = rgb(0.38, 0.42, 0.4);

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Lays text out down A4 pages, starting a new page when one is full. */
class PdfWriter {
	readonly #document: PDFDocument;
	readonly #regular: EmbeddedFont;
	readonly #bold: EmbeddedFont;
	#page: PDFPage;
	#y = 0;

	/** Starts a document on its first page. */
	constructor(
		document: PDFDocument,
		regular: EmbeddedFont,
		bold: EmbeddedFont,
	) {
		this.#document = document;
		this.#regular = regular;
		this.#bold = bold;
		this.#page = document.addPage(pageSize);
		this.#y = pageSize[1] - margin;
	}

	/** Moves down by `height`, starting a new page when the current one is full. */
	advance(height: number): void {
		if (this.#y - height < margin) {
			this.#page = this.#document.addPage(pageSize);
			this.#y = pageSize[1] - margin;
		}
		this.#y -= height;
	}

	/** Writes `text` at column `x` on the current line, cut to `width` points. */
	text(
		text: string,
		x: number,
		{
			size = 10,
			bold = false,
			color = rgb(0.08, 0.1, 0.09),
			width = pageSize[0] - margin - x,
			alignRight = false,
		} = {},
	): void {
		const embedded = bold ? this.#bold : this.#regular;
		const { font } = embedded;
		let value = this.#printable(text, embedded);
		while (value.length > 1 && font.widthOfTextAtSize(value, size) > width) {
			value = `${value.slice(0, -2)}…`;
		}
		const measured = font.widthOfTextAtSize(value, size);
		this.#page.drawText(value, {
			x: alignRight ? x + width - measured : x,
			y: this.#y,
			size,
			font,
			color,
		});
	}

	/** Writes a new line with `label` on the left and `amount` on the right, ruled under. */
	row(label: string, amount: string): void {
		this.advance(18);
		this.text(label, margin, { width: 330 });
		this.text(amount, pageSize[0] - margin - 150, {
			width: 150,
			alignRight: true,
		});
		this.rule();
	}

	/** Draws a thin rule under the current line. */
	rule(): void {
		this.#page.drawLine({
			start: { x: margin, y: this.#y - 4 },
			end: { x: pageSize[0] - margin, y: this.#y - 4 },
			thickness: 0.5,
			color: rgb(0.85, 0.87, 0.86),
		});
	}

	/** `text` with every grapheme the font can't draw replaced by `?`. */
	#printable(text: string, { characters }: EmbeddedFont): string {
		return Array.from(graphemes.segment(text.replaceAll(/\s/g, " ")))
			.map(({ segment }) =>
				Array.from(segment).every((character) =>
					characters.has(character.codePointAt(0) ?? 0),
				)
					? segment
					: "?",
			)
			.join("");
	}
}

/** A group's exports: its expenses as CSV, and a PDF with balances, settlements and every expense. */
class GroupExport {
	/** Everything an export of `groupId` shows, read once. */
	source(
		groupId: string,
		group: { name: string; currency: string },
	): GroupExportSource {
		return {
			...group,
			members: GroupMemberDTO.forGroup(groupId).map((member) =>
				member.toJSON(),
			),
			expenses: ExpenseDTO.forGroup(groupId)
				.map((entry) => entry.toJSON())
				.reverse(),
			categoryNames: new Map<string, string>([
				...Object.entries(categoryLabels),
				...GroupCategoryDTO.forGroup(groupId).map(
					(entry) => [entry.toJSON().id, entry.toJSON().name] as const,
				),
			]),
		};
	}

	/** The group's expenses and transfers as CSV, oldest first, one share column per member; with a BOM for spreadsheets. */
	csv(source: GroupExportSource): string {
		const names = new Map(
			source.members.map((member) => [member.id, member.displayName]),
		);
		const header = [
			"Date",
			"Description",
			"Category",
			"Type",
			"Paid by",
			"Amount",
			"Currency",
			"Original amount",
			"Original currency",
			"Exchange rate",
			...source.members.map((member) => `Share of ${member.displayName}`),
		];
		const rows = source.expenses.map((entry) => {
			const shares = new Map(
				entry.shares.map((share) => [share.memberId, share.amountMinor]),
			);
			return [
				entry.spentOn,
				entry.description,
				source.categoryNames.get(entry.category) ?? categoryLabels.other,
				entry.kind === "transfer" ? "Transfer" : "Expense",
				names.get(entry.paidBy) ?? "",
				minorToDecimal(entry.amountMinor, source.currency),
				source.currency,
				entry.originalCurrency && entry.originalAmountMinor !== null
					? minorToDecimal(entry.originalAmountMinor, entry.originalCurrency)
					: "",
				entry.originalCurrency ?? "",
				entry.exchangeRate === null ? "" : String(entry.exchangeRate),
				...source.members.map((member) => {
					const share = shares.get(member.id);
					return share === undefined
						? ""
						: minorToDecimal(share, source.currency);
				}),
			];
		});
		return `﻿${[header, ...rows]
			.map((row) => row.map((cell) => this.#csvCell(cell)).join(","))
			.join("\r\n")}\r\n`;
	}

	/** The group as a PDF: balances, the payments that settle them, then every expense and transfer, oldest first. */
	async pdf(
		source: GroupExportSource,
		generatedOn: string,
	): Promise<Uint8Array> {
		const document = await PDFDocument.create();
		document.registerFontkit(fontkit);
		document.setTitle(source.name);
		document.setCreator("OpenCount");
		const writer = new PdfWriter(
			document,
			await this.#embedFont(document, "NotoSans-Regular.ttf"),
			await this.#embedFont(document, "NotoSans-Bold.ttf"),
		);
		const names = new Map(
			source.members.map((member) => [member.id, member.displayName]),
		);
		const money = (minor: number, signed = false) =>
			formatMoney(minor, source.currency, { signed });
		const right = pageSize[0] - margin;

		writer.advance(18);
		writer.text(source.name, margin, { size: 20, bold: true });
		writer.advance(18);
		writer.text(
			`${source.currency} · ${source.members.length} members · exported ${generatedOn}`,
			margin,
			{ color: muted },
		);

		const balances = computeBalances(
			source.members.map((member) => member.id),
			source.expenses.map((entry) => ({
				paidBy: entry.paidBy,
				amountMinor: entry.amountMinor,
				shares: entry.shares,
			})),
		);
		writer.advance(36);
		writer.text("Balances", margin, { size: 13, bold: true });
		for (const member of source.members) {
			writer.row(member.displayName, money(balances.get(member.id) ?? 0, true));
		}

		const transfers = settleUp(balances);
		writer.advance(36);
		writer.text("To settle up", margin, { size: 13, bold: true });
		if (transfers.length === 0) {
			writer.advance(18);
			writer.text("Everyone is settled.", margin, { color: muted });
		}
		for (const transfer of transfers) {
			writer.row(
				`${names.get(transfer.from) ?? "?"} pays ${names.get(transfer.to) ?? "?"}`,
				money(transfer.amountMinor),
			);
		}

		writer.advance(36);
		writer.text("Expenses", margin, { size: 13, bold: true });
		writer.advance(18);
		for (const [label, x] of [
			["Date", margin],
			["Description", margin + 70],
			["Paid by", margin + 290],
		] as const) {
			writer.text(label, x, { size: 9, bold: true, color: muted });
		}
		writer.text("Amount", right - 100, {
			size: 9,
			bold: true,
			color: muted,
			width: 100,
			alignRight: true,
		});
		writer.rule();
		for (const entry of source.expenses) {
			writer.advance(18);
			writer.text(entry.spentOn, margin, { size: 9 });
			writer.text(
				entry.kind === "transfer"
					? `${entry.description} to ${names.get(entry.shares[0]?.memberId ?? "") ?? "?"}`
					: entry.description,
				margin + 70,
				{ size: 9, width: 210 },
			);
			writer.text(names.get(entry.paidBy) ?? "?", margin + 290, {
				size: 9,
				width: 120,
			});
			writer.text(money(entry.amountMinor), right - 100, {
				size: 9,
				width: 100,
				alignRight: true,
			});
			writer.rule();
		}
		return document.save();
	}

	/** A CSV cell for `raw`, quoted when needed and defused when a spreadsheet would read it as a formula. */
	#csvCell(raw: string): string {
		const value =
			/^[=+\-@\t\r]/.test(raw) && !/^-?\d+(?:[.,]\d+)?$/.test(raw)
				? `'${raw}`
				: raw;
		return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
	}

	/** `file` from `fonts/` embedded in `document`, subset, with the characters it can draw. */
	async #embedFont(document: PDFDocument, file: string): Promise<EmbeddedFont> {
		const font = await document.embedFont(
			await Bun.file(join(process.cwd(), "fonts", file)).arrayBuffer(),
			{ subset: true },
		);
		return { font, characters: new Set(font.getCharacterSet()) };
	}
}

export const groupExport = new GroupExport();
