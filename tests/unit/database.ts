import { databaseConnection } from "#lib/server/db/database.js";
import {
	appearance,
	expense,
	group,
	groupMember,
	invite,
	job,
	merchant,
	recurringExpense,
	setting,
	user,
	verification,
} from "#lib/server/db/schema.js";

export function resetDatabase(): void {
	databaseConnection.migrate();
	const database = databaseConnection.get();
	for (const table of [job, invite, setting, appearance, verification]) {
		database.delete(table).run();
	}
	database.delete(expense).run();
	database.delete(recurringExpense).run();
	database.delete(merchant).run();
	database.delete(groupMember).run();
	database.delete(group).run();
	database.delete(user).run();
}

export function createUser(
	id: string,
	name = "Ada",
): { id: string; name: string } {
	databaseConnection
		.get()
		.insert(user)
		.values({ id, name, email: `${id}@example.com` })
		.run();
	return { id, name };
}
