export type Frequency = "weekly" | "monthly" | "yearly";

export const frequencyLabels: Record<Frequency, string> = {
	weekly: "Every week",
	monthly: "Every month",
	yearly: "Every year",
};

function daysInMonth(year: number, monthIndex: number): number {
	return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * The occurrence after `date` (YYYY-MM-DD). Monthly and yearly rules land on `anchorDay`, or the month's last day when
 * it is shorter, so a rule started on the 31st goes 31 Jan, 28 Feb, 31 Mar instead of drifting to the 28th.
 */
export function nextOccurrence(
	date: string,
	frequency: Frequency,
	anchorDay: number,
): string {
	const [year, month, day] = date.split("-").map(Number) as [
		number,
		number,
		number,
	];
	let next: Date;
	if (frequency === "weekly") {
		next = new Date(Date.UTC(year, month - 1, day + 7));
	} else {
		const targetYear = frequency === "yearly" ? year + 1 : year;
		const targetMonth = frequency === "yearly" ? month - 1 : month;
		const normalised = new Date(Date.UTC(targetYear, targetMonth, 1));
		next = new Date(
			Date.UTC(
				normalised.getUTCFullYear(),
				normalised.getUTCMonth(),
				Math.min(
					anchorDay,
					daysInMonth(normalised.getUTCFullYear(), normalised.getUTCMonth()),
				),
			),
		);
	}
	return next.toISOString().slice(0, 10);
}
