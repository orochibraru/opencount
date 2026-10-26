export const currencies = [
	"EUR",
	"USD",
	"GBP",
	"CHF",
	"CAD",
	"AUD",
	"JPY",
	"SEK",
	"NOK",
	"DKK",
	"PLN",
	"CZK",
] as const;

export type Currency = (typeof currencies)[number];
