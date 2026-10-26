import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";

import { getConfig } from "#lib/server/config.js";
import * as schema from "#lib/server/db/schema.js";

export type AppDatabase = BunSQLiteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
	__opencountSqlite?: Database;
	__opencountDb?: AppDatabase;
};

function openSqlite(): Database {
	if (getConfig().databasePath !== ":memory:") {
		mkdirSync(dirname(getConfig().databasePath), { recursive: true });
	}
	const sqlite = new Database(getConfig().databasePath, {
		create: true,
		strict: true,
	});
	sqlite.exec("PRAGMA journal_mode = WAL");
	sqlite.exec("PRAGMA synchronous = NORMAL");
	sqlite.exec("PRAGMA foreign_keys = ON");
	sqlite.exec("PRAGMA busy_timeout = 5000");
	return sqlite;
}

/** The shared Drizzle instance, opening the SQLite file on first use and reusing it across Vite HMR reloads. */
export function getDb(): AppDatabase {
	globalForDb.__opencountSqlite ??= openSqlite();
	globalForDb.__opencountDb ??= drizzle({
		client: globalForDb.__opencountSqlite,
		schema,
	});
	return globalForDb.__opencountDb;
}

export class MigrationHistoryError extends Error {}

/**
 * Checks every migration recorded in the database still exists, unchanged, in `migrations`: drizzle only compares
 * timestamps, so an edited or replaced migration would otherwise be re-run against tables that already exist.
 *
 * @throws MigrationHistoryError naming the database and how to recover.
 */
export function assertMigrationHistory(
	sqlite: Database,
	migrations: MigrationMeta[],
	databasePath: string,
): void {
	const recorded = sqlite
		.query(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
		)
		.get();
	if (!recorded) {
		return;
	}
	const known = new Map(
		migrations.map((migration) => [migration.folderMillis, migration.hash]),
	);
	const applied = sqlite
		.query<{ hash: string; created_at: number }, []>(
			"SELECT hash, created_at FROM __drizzle_migrations",
		)
		.all();
	for (const row of applied) {
		if (known.get(Number(row.created_at)) !== row.hash) {
			throw new MigrationHistoryError(
				`The database at ${databasePath} was migrated with a migration that drizzle/ no longer has unchanged ` +
					`(generated ${new Date(Number(row.created_at)).toISOString()}). A committed migration was edited or removed: ` +
					"restore it from git and add schema changes as a new migration. A local development database can instead be deleted.",
			);
		}
	}
}

/**
 * Applies every pending migration from `drizzle/` in the working directory, after checking the database's history.
 *
 * @throws MigrationHistoryError when the history and `drizzle/` disagree.
 */
export function migrateDb(): void {
	const migrationsFolder = join(process.cwd(), "drizzle");
	const database = getDb();
	assertMigrationHistory(
		globalForDb.__opencountSqlite as Database,
		readMigrationFiles({ migrationsFolder }),
		getConfig().databasePath,
	);
	migrate(database, { migrationsFolder });
}

/** Closes the SQLite handle; the next `getDb()` reopens it. */
export function closeDb(): void {
	globalForDb.__opencountSqlite?.close();
	globalForDb.__opencountSqlite = undefined;
	globalForDb.__opencountDb = undefined;
}

/** Writes a consistent copy of the live database to `path`, which must not exist yet. */
export function backupDatabase(path: string): void {
	getDb();
	(globalForDb.__opencountSqlite as Database).query("VACUUM INTO ?").run(path);
}

export class RestoreError extends Error {}

const keptOnRestore = new Set(["__drizzle_migrations", "job", "download"]);

/**
 * Replaces every row of the live database with the rows of the SQLite file at `path`, after checking it and migrating
 * it to the current schema: all or nothing. The job queue and downloads stay as they are.
 *
 * @throws RestoreError when the file isn't an OpenCount database or its rows don't hold together.
 */
export function restoreDatabase(path: string): void {
	const migrationsFolder = join(process.cwd(), "drizzle");
	const backup = new Database(path, { strict: true });
	try {
		const tables = backup
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user', '__drizzle_migrations')",
			)
			.all();
		if (tables.length !== 2) {
			throw new RestoreError("That file isn't an OpenCount backup.");
		}
		const integrity = backup
			.query<{ integrity_check: string }, []>("PRAGMA integrity_check")
			.get();
		if (integrity?.integrity_check !== "ok") {
			throw new RestoreError("That backup is damaged.");
		}
		try {
			assertMigrationHistory(
				backup,
				readMigrationFiles({ migrationsFolder }),
				path,
			);
		} catch {
			throw new RestoreError(
				"That backup comes from a version of OpenCount this server doesn't know.",
			);
		}
		migrate(drizzle({ client: backup }), { migrationsFolder });
	} finally {
		backup.close();
	}

	getDb();
	const sqlite = globalForDb.__opencountSqlite as Database;
	const tables = sqlite
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
		)
		.all()
		.map((row) => row.name)
		.filter((name) => !keptOnRestore.has(name));
	sqlite.exec("PRAGMA foreign_keys = OFF");
	sqlite.query("ATTACH DATABASE ? AS backup").run(path);
	try {
		sqlite.transaction(() => {
			for (const table of tables) {
				sqlite.exec(`DELETE FROM main."${table}"`);
				sqlite.exec(
					`INSERT INTO main."${table}" SELECT * FROM backup."${table}"`,
				);
			}
			sqlite.exec("DELETE FROM main.download");
			if (sqlite.query("PRAGMA main.foreign_key_check").get()) {
				throw new RestoreError("The rows in that backup don't hold together.");
			}
		})();
	} finally {
		sqlite.exec("DETACH DATABASE backup");
		sqlite.exec("PRAGMA foreign_keys = ON");
	}
}
