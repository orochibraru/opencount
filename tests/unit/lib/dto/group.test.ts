import { beforeEach, describe, expect, test } from "bun:test";

import { GroupDTO } from "#lib/dto/group.js";

import { createUser, resetDatabase } from "../../database.js";

describe("GroupDTO", () => {
	beforeEach(resetDatabase);

	test("create makes the owner the first member", () => {
		const owner = createUser("owner");
		const created = GroupDTO.create({
			name: "Lisbon",
			currency: "EUR",
			owner,
		}).toJSON();
		expect(created).toMatchObject({
			name: "Lisbon",
			currency: "EUR",
			memberCount: 1,
		});
		expect(
			GroupDTO.forMember(owner.id).map((group) => group.toJSON().id),
		).toEqual([created.id]);
	});

	test("forMember only returns groups the user belongs to", () => {
		const owner = createUser("owner");
		const stranger = createUser("stranger", "Grace");
		GroupDTO.create({ name: "Flat", currency: "GBP", owner });
		expect(GroupDTO.forMember(stranger.id)).toEqual([]);
	});
});

describe("closeDb", () => {
	test("the next getDb() reopens the database", async () => {
		const { closeDb, getDb } = await import("#lib/server/db/lib.js");
		const before = getDb();
		closeDb();
		expect(getDb()).not.toBe(before);
	});
});
