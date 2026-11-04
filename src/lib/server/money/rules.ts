import { categories } from "#lib/categories.js";
import { PersonalCategoryDTO } from "#lib/dto/personal-category.js";
import { PersonalExpenseDTO } from "#lib/dto/personal-expense.js";
import {
	PersonalRuleDTO,
	type PersonalRuleInput,
	type PersonalRuleRow,
} from "#lib/dto/personal-rule.js";
import { RecurringSeriesDTO } from "#lib/dto/recurring-series.js";

export type RuleOutcome =
	| { rule: PersonalRuleRow; applied: number }
	| { error: "category" | "series" | "missing" | "empty" };

/** Someone's rules: "a line whose description has this in it gets that category, tag, series or counts as pay". */
class RuleBook {
	/** `userId`'s rules, oldest first. */
	list(userId: string): PersonalRuleRow[] {
		return PersonalRuleDTO.forUser(userId).map((rule) => rule.toJSON());
	}

	/**
	 * Saves a rule for `userId` (rule `id` when given, a new one otherwise) after checking its category and series are
	 * theirs and it sets something, then applies every rule to all their lines. Says what went wrong instead when it
	 * can't.
	 */
	save(userId: string, input: PersonalRuleInput, id?: string): RuleOutcome {
		if (!input.category && !input.tag && !input.pay && !input.recurringId) {
			return { error: "empty" };
		}
		if (input.category && !this.#knownCategory(userId, input.category)) {
			return { error: "category" };
		}
		if (
			input.recurringId &&
			!RecurringSeriesDTO.findForUser(input.recurringId, userId)
		) {
			return { error: "series" };
		}
		let rule: PersonalRuleDTO;
		if (id) {
			const existing = PersonalRuleDTO.findForUser(id, userId);
			if (!existing) {
				return { error: "missing" };
			}
			existing.update(input);
			rule = existing;
		} else {
			rule = PersonalRuleDTO.create(userId, input);
		}
		return { rule: rule.toJSON(), applied: this.apply(userId) };
	}

	/** Deletes `userId`'s rule `id`, leaving the lines it filed as they are; false when it isn't theirs. */
	remove(userId: string, id: string): boolean {
		const rule = PersonalRuleDTO.findForUser(id, userId);
		rule?.delete(userId);
		return rule !== undefined;
	}

	/** Applies every rule of `userId` to all their lines; returns how many changed. */
	apply(userId: string): number {
		return PersonalExpenseDTO.applyRules(userId, this.list(userId));
	}

	/** Whether `category` is a built-in category or one of `userId`'s own. */
	#knownCategory(userId: string, category: string): boolean {
		return (
			categories.some((option) => option.value === category) ||
			PersonalCategoryDTO.findForUser(category, userId) !== undefined
		);
	}
}

export const ruleBook = new RuleBook();
