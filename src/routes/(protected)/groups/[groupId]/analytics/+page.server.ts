import {
	type Period,
	periodRange,
	periods,
	summarize,
} from "#lib/analytics.js";
import { ExpenseDTO } from "#lib/dto/expense.js";
import { MerchantDTO } from "#lib/dto/merchant.js";

export const load = async ({ parent, url }) => {
	const { group, myMemberId } = await parent();
	const requested = url.searchParams.get("period");
	const period: Period = periods.includes(requested as Period)
		? (requested as Period)
		: "month";
	const expenses = ExpenseDTO.forGroup(group.id)
		.map((entry) => entry.toJSON())
		.filter((entry) => entry.kind === "expense");
	const range = periodRange(
		period,
		new Date().toISOString().slice(0, 10),
		expenses.at(-1)?.spentOn,
	);
	return {
		period,
		summary: summarize(expenses, range, myMemberId),
		merchants: MerchantDTO.forGroup(group.id).map((entry) => entry.toJSON()),
	};
};
