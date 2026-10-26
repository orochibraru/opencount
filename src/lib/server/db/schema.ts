import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
	integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
	integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
		.$onUpdate(() => new Date());

export const userRoles = ["admin", "member"] as const;

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(
		false,
	),
	role: text("role", { enum: userRoles }).notNull().default("member"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", {
			mode: "timestamp_ms",
		}),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", {
			mode: "timestamp_ms",
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const group = sqliteTable("group", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	currency: text("currency").notNull().default("EUR"),
	createdBy: text("created_by").references(() => user.id, {
		onDelete: "set null",
	}),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const groupMember = sqliteTable(
	"group_member",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		displayName: text("display_name").notNull(),
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		createdAt: createdAt(),
	},
	(table) => [
		index("group_member_group_id_idx").on(table.groupId),
		uniqueIndex("group_member_group_user_idx").on(table.groupId, table.userId),
	],
);

export const merchant = sqliteTable(
	"merchant",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		nameKey: text("name_key").notNull(),
		category: text("category").notNull().default("other"),
		useCount: integer("use_count").notNull().default(0),
		lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
	},
	(table) => [
		uniqueIndex("merchant_group_name_idx").on(table.groupId, table.nameKey),
	],
);

export const jobStatuses = ["pending", "running", "done", "failed"] as const;

export const job = sqliteTable(
	"job",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		type: text("type").notNull(),
		payload: text("payload", { mode: "json" }).notNull(),
		status: text("status", { enum: jobStatuses }).notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(5),
		runAt: integer("run_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
		finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
		lastError: text("last_error"),
		createdAt: createdAt(),
	},
	(table) => [index("job_status_run_at_idx").on(table.status, table.runAt)],
);

export const twoFactor = sqliteTable(
	"two_factor",
	{
		id: text("id").primaryKey(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		verified: integer("verified", { mode: "boolean" }).default(true),
		failedVerificationCount: integer("failed_verification_count").default(0),
		lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("two_factor_user_id_idx").on(table.userId),
		index("two_factor_secret_idx").on(table.secret),
	],
);

export const passkey = sqliteTable(
	"passkey",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		publicKey: text("public_key").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		credentialID: text("credential_id").notNull(),
		counter: integer("counter").notNull(),
		deviceType: text("device_type").notNull(),
		backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
		transports: text("transports"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
		aaguid: text("aaguid"),
	},
	(table) => [
		index("passkey_user_id_idx").on(table.userId),
		index("passkey_credential_id_idx").on(table.credentialID),
	],
);

export const setting = sqliteTable("setting", {
	key: text("key").primaryKey(),
	value: text("value", { mode: "json" }).notNull(),
	updatedAt: updatedAt(),
});

export const invite = sqliteTable(
	"invite",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		email: text("email").notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		invitedBy: text("invited_by").references(() => user.id, {
			onDelete: "set null",
		}),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
		createdAt: createdAt(),
	},
	(table) => [index("invite_email_idx").on(table.email)],
);

export const accents = [
	"bordeaux",
	"green",
	"blue",
	"violet",
	"rose",
	"orange",
	"amber",
	"cyan",
	"neutral",
] as const;
export const themes = ["system", "light", "dark"] as const;
export const darkVariants = ["default", "amoled"] as const;
export const fonts = ["default", "system", "serif", "mono"] as const;
export const cornerStyles = ["rounded", "square"] as const;

export const appearance = sqliteTable("appearance", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	accent: text("accent", { enum: accents }).notNull().default("bordeaux"),
	theme: text("theme", { enum: themes }).notNull().default("system"),
	darkVariant: text("dark_variant", { enum: darkVariants })
		.notNull()
		.default("default"),
	font: text("font", { enum: fonts }).notNull().default("default"),
	corners: text("corners", { enum: cornerStyles }).notNull().default("rounded"),
	updatedAt: updatedAt(),
});

export const expenseCategories = [
	"food",
	"groceries",
	"transport",
	"lodging",
	"activities",
	"shopping",
	"bills",
	"other",
] as const;
export const expenseKinds = ["expense", "transfer"] as const;
export const splitModes = ["equal", "exact", "shares"] as const;

export const expense = sqliteTable(
	"expense",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		kind: text("kind", { enum: expenseKinds }).notNull().default("expense"),
		description: text("description").notNull(),
		category: text("category").notNull().default("other"),
		amountMinor: integer("amount_minor").notNull(),
		paidBy: text("paid_by")
			.notNull()
			.references(() => groupMember.id, { onDelete: "restrict" }),
		splitMode: text("split_mode", { enum: splitModes })
			.notNull()
			.default("equal"),
		spentOn: text("spent_on").notNull(),
		merchantId: text("merchant_id").references(() => merchant.id, {
			onDelete: "set null",
		}),
		recurringId: text("recurring_id").references(() => recurringExpense.id, {
			onDelete: "set null",
		}),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("expense_group_id_idx").on(table.groupId, table.spentOn)],
);

export const expenseShare = sqliteTable(
	"expense_share",
	{
		expenseId: text("expense_id")
			.notNull()
			.references(() => expense.id, { onDelete: "cascade" }),
		memberId: text("member_id")
			.notNull()
			.references(() => groupMember.id, { onDelete: "restrict" }),
		amountMinor: integer("amount_minor").notNull(),
		weight: integer("weight").notNull().default(1),
	},
	(table) => [
		uniqueIndex("expense_share_expense_member_idx").on(
			table.expenseId,
			table.memberId,
		),
		index("expense_share_member_id_idx").on(table.memberId),
	],
);

export const recurrenceFrequencies = ["weekly", "monthly", "yearly"] as const;

export const recurringExpense = sqliteTable(
	"recurring_expense",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		description: text("description").notNull(),
		category: text("category").notNull().default("other"),
		merchantId: text("merchant_id").references(() => merchant.id, {
			onDelete: "set null",
		}),
		amountMinor: integer("amount_minor").notNull(),
		paidBy: text("paid_by")
			.notNull()
			.references(() => groupMember.id, { onDelete: "restrict" }),
		splitMode: text("split_mode", { enum: splitModes })
			.notNull()
			.default("equal"),
		frequency: text("frequency", { enum: recurrenceFrequencies }).notNull(),
		nextOn: text("next_on").notNull(),
		anchorDay: integer("anchor_day").notNull().default(1),
		active: integer("active", { mode: "boolean" }).notNull().default(true),
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
	},
	(table) => [
		index("recurring_expense_due_idx").on(table.active, table.nextOn),
	],
);

export const recurringShare = sqliteTable(
	"recurring_share",
	{
		recurringId: text("recurring_id")
			.notNull()
			.references(() => recurringExpense.id, { onDelete: "cascade" }),
		memberId: text("member_id")
			.notNull()
			.references(() => groupMember.id, { onDelete: "restrict" }),
		amountMinor: integer("amount_minor").notNull(),
		weight: integer("weight").notNull().default(1),
	},
	(table) => [
		uniqueIndex("recurring_share_recurring_member_idx").on(
			table.recurringId,
			table.memberId,
		),
	],
);

export const groupCategory = sqliteTable(
	"group_category",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		groupId: text("group_id")
			.notNull()
			.references(() => group.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		icon: text("icon").notNull(),
		createdAt: createdAt(),
	},
	(table) => [index("group_category_group_id_idx").on(table.groupId)],
);
