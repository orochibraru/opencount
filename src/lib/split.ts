export type SplitMode = "equal" | "exact" | "shares";

export interface SplitInput {
	memberId: string;
	weight: number;
}

/**
 * Divides `totalMinor` between members in proportion to their weights (1 each for an equal split), handing the leftover
 * minor units one by one to the members listed first, so the parts always add up to the total.
 */
export function splitByWeight(
	totalMinor: number,
	inputs: SplitInput[],
): Map<string, number> {
	const participants = inputs.filter((input) => input.weight > 0);
	const totalWeight = participants.reduce(
		(sum, input) => sum + input.weight,
		0,
	);
	const result = new Map<string, number>();
	if (totalWeight === 0) {
		return result;
	}
	let assigned = 0;
	for (const input of participants) {
		const part = Math.floor((totalMinor * input.weight) / totalWeight);
		result.set(input.memberId, part);
		assigned += part;
	}
	let leftover = totalMinor - assigned;
	for (const input of participants) {
		if (leftover <= 0) {
			break;
		}
		result.set(input.memberId, (result.get(input.memberId) ?? 0) + 1);
		leftover -= 1;
	}
	return result;
}
