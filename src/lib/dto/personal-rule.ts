import { and, asc, eq } from "drizzle-orm";

import { BaseDTO } from "#lib/dto/base-dto.js";
import { databaseConnection } from "#lib/server/db/database.js";
import { personalRule } from "#lib/server/db/schema.js";

export interface PersonalRuleRow {
	id: string;
	pattern: string;
	category: string | null;
	tag: string | null;
	pay: boolean;
	recurringId: string | null;
}

export type PersonalRuleInput = Omit<PersonalRuleRow, "id">;

const columns = {
	id: personalRule.id,
	pattern: personalRule.pattern,
	category: personalRule.category,
	tag: personalRule.tag,
	pay: personalRule.pay,
	recurringId: personalRule.recurringId,
};

export class PersonalRuleDTO extends BaseDTO<PersonalRuleRow> {
	/** `userId`'s rules, oldest first: a newer rule wins where two set the same thing. */
	static forUser(userId: string): PersonalRuleDTO[] {
		return databaseConnection
			.get()
			.select(columns)
			.from(personalRule)
			.where(eq(personalRule.userId, userId))
			.orderBy(asc(personalRule.createdAt))
			.all()
			.map((row) => new PersonalRuleDTO(row));
	}

	/** Rule `id`, only when it belongs to `userId`. */
	static findForUser(id: string, userId: string): PersonalRuleDTO | undefined {
		return PersonalRuleDTO.forUser(userId).find((rule) => rule.id === id);
	}

	/** Records a rule for `userId`. */
	static create(userId: string, input: PersonalRuleInput): PersonalRuleDTO {
		return new PersonalRuleDTO(
			databaseConnection
				.get()
				.insert(personalRule)
				.values({ ...input, userId })
				.returning(columns)
				.get(),
		);
	}

	get id(): string {
		return this.row.id;
	}

	/** Replaces what the rule matches and sets. */
	update(input: PersonalRuleInput): void {
		databaseConnection
			.get()
			.update(personalRule)
			.set(input)
			.where(eq(personalRule.id, this.row.id))
			.run();
		Object.assign(this.row, input);
	}

	/** Deletes the rule of `userId`; the lines it filed stay as they are. */
	delete(userId: string): void {
		databaseConnection
			.get()
			.delete(personalRule)
			.where(
				and(eq(personalRule.id, this.row.id), eq(personalRule.userId, userId)),
			)
			.run();
	}
}
