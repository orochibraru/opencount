import type { Category, CustomCategory } from "#lib/categories.js";

const keywords: [Category, string[]][] = [
	[
		"groceries",
		[
			"grocery",
			"groceries",
			"supermarket",
			"supermarche",
			"courses",
			"carrefour",
			"lidl",
			"aldi",
			"leclerc",
			"auchan",
			"monoprix",
			"intermarche",
			"franprix",
			"picard",
			"biocoop",
			"tesco",
			"sainsbury",
			"walmart",
			"costco",
			"market",
			"marche",
		],
	],
	[
		"food",
		[
			"restaurant",
			"resto",
			"dinner",
			"lunch",
			"breakfast",
			"brunch",
			"diner",
			"dejeuner",
			"cafe",
			"coffee",
			"bar",
			"pub",
			"beer",
			"beers",
			"biere",
			"wine",
			"vin",
			"pizza",
			"burger",
			"sushi",
			"kebab",
			"tacos",
			"bakery",
			"boulangerie",
			"mcdonald",
			"mcdonalds",
			"starbucks",
			"uber eats",
			"deliveroo",
			"drinks",
			"apero",
			"snack",
			"snacks",
			"ice cream",
			"glace",
			"takeaway",
		],
	],
	[
		"transport",
		[
			"taxi",
			"uber",
			"bolt",
			"train",
			"sncf",
			"tgv",
			"ouigo",
			"flight",
			"flights",
			"vol",
			"plane",
			"avion",
			"airline",
			"ryanair",
			"easyjet",
			"air france",
			"bus",
			"metro",
			"subway",
			"tram",
			"fuel",
			"gas",
			"essence",
			"gasoil",
			"diesel",
			"petrol",
			"parking",
			"toll",
			"peage",
			"car rental",
			"location voiture",
			"ferry",
			"bike",
			"velo",
			"navigo",
			"blablacar",
		],
	],
	[
		"lodging",
		[
			"hotel",
			"airbnb",
			"booking",
			"hostel",
			"auberge",
			"camping",
			"rent",
			"loyer",
			"apartment",
			"appartement",
			"gite",
			"chalet",
		],
	],
	[
		"activities",
		[
			"museum",
			"musee",
			"cinema",
			"movie",
			"movies",
			"film",
			"concert",
			"tickets",
			"billet",
			"billets",
			"show",
			"spectacle",
			"tour",
			"visite",
			"excursion",
			"ski",
			"skipass",
			"surf",
			"bowling",
			"escape game",
			"festival",
			"theatre",
			"zoo",
			"gym",
			"climbing",
			"escalade",
			"karting",
		],
	],
	[
		"shopping",
		[
			"amazon",
			"shop",
			"shopping",
			"store",
			"boutique",
			"clothes",
			"vetements",
			"shoes",
			"chaussures",
			"zara",
			"ikea",
			"decathlon",
			"fnac",
			"gift",
			"cadeau",
			"souvenir",
			"souvenirs",
		],
	],
	[
		"bills",
		[
			"electricity",
			"electricite",
			"edf",
			"engie",
			"water bill",
			"internet",
			"wifi",
			"phone",
			"telephone",
			"netflix",
			"spotify",
			"subscription",
			"abonnement",
			"insurance",
			"assurance",
			"bill",
			"facture",
		],
	],
];

function normalise(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

const rules = keywords.map(
	([category, words]) =>
		[
			category,
			new RegExp(`(^|[^a-z0-9])(${words.join("|")})($|[^a-z0-9])`),
		] as const,
);

function escape(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The category an expense called `text` most likely belongs to: one of `custom` whose name it mentions, or else a
 * built-in one from keywords in English and French.
 */
export function guessCategory(
	text: string,
	custom: CustomCategory[] = [],
): string | undefined {
	const normalised = normalise(text);
	const own = custom.find((category) => {
		const name = normalise(category.name).trim();
		return (
			name !== "" &&
			new RegExp(`(^|[^a-z0-9])${escape(name)}($|[^a-z0-9])`).test(normalised)
		);
	});
	return own?.id ?? rules.find(([, pattern]) => pattern.test(normalised))?.[0];
}
