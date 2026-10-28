import { fail } from "@sveltejs/kit";
import { z } from "zod";

import { getSetting, setSetting } from "#lib/dto/setting.js";
import { access } from "#lib/server/auth/access.js";
import { receiptReader } from "#lib/server/receipts/ocr.js";
import { receiptUpload } from "#lib/server/receipts/receipt-upload.js";

export const load = async ({ parent }) => {
	await parent();
	return {
		installed: receiptReader.isTesseractInstalled(),
		pdfReadable: receiptReader.isPopplerInstalled(),
		availableLanguages: await receiptReader.installedLanguages(),
		ocr: getSetting("ocr"),
	};
};

export const actions = {
	save: async ({ locals, request }) => {
		const admin = access.adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		const available = await receiptReader.installedLanguages();
		if (available.length === 0) {
			return fail(400, { error: "Tesseract isn't installed on this server." });
		}
		const languages = z
			.array(z.enum(available as [string, ...string[]]))
			.min(1, "Pick at least one language.")
			.safeParse((await request.formData()).getAll("languages"));
		if (!languages.success) {
			return fail(400, {
				error:
					languages.error.issues[0]?.message ?? "Pick at least one language.",
			});
		}
		setSetting("ocr", { languages: languages.data });
		return { saved: true };
	},
	remove: ({ locals }) => {
		const admin = access.adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		setSetting("ocr", null);
		return { removed: true };
	},
	scan: async ({ locals, request }) => {
		const admin = access.adminFrom(locals);
		if (!("id" in admin)) {
			return admin;
		}
		if (!getSetting("ocr")) {
			return fail(400, { error: "Turn receipt reading on first." });
		}
		const result = await receiptUpload.read(await request.formData());
		if ("error" in result) {
			return fail(400, { error: result.error });
		}
		return { reading: result.reading };
	},
};
