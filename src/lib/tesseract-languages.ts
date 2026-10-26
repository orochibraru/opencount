const specialNames: Record<string, string> = {
	frk: "German (Fraktur)",
	equ: "Math equations",
	osd: "Script detection",
};

const variantNames: Record<string, string> = {
	sim: "Simplified",
	tra: "Traditional",
	vert: "vertical",
	cyrl: "Cyrillic",
	latn: "Latin",
	old: "old",
};

/** A readable name for a Tesseract language code, like "Chinese (Simplified, vertical)" for `chi_sim_vert`. */
export function tesseractLanguageName(code: string, locale?: string): string {
	if (specialNames[code]) {
		return specialNames[code];
	}
	const [base = code, ...variants] = code.split("_");
	let name: string | undefined;
	try {
		name = new Intl.DisplayNames(locale, {
			type: "language",
			fallback: "none",
		}).of(base);
	} catch {
		name = undefined;
	}
	if (!name) {
		return code;
	}
	return variants.length > 0
		? `${name} (${variants.map((variant) => variantNames[variant] ?? variant).join(", ")})`
		: name;
}
