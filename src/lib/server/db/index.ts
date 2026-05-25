import LibsqlDatabase from "libsql";
import { Kysely, Migrator, SqliteDialect, sql, type Migration, type MigrationProvider } from "kysely";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, DB_FILE } from "../paths";
import type { Database } from "./schema";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(CURRENT_DIR, "migrations");

let sqlite: LibsqlDatabase.Database | undefined;
let kysely: Kysely<Database> | undefined;

function splitSqlStatements(source: string) {
  // Migration files are simple DDL statements separated by semicolons.
  return source
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function getSqlite() {
  if (sqlite) return sqlite;

  await mkdir(DATA_DIR, { recursive: true });
  sqlite = new LibsqlDatabase(DB_FILE);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

export async function getDb() {
  if (kysely) return kysely;

  kysely = new Kysely<Database>({
    dialect: new SqliteDialect({
      database: await getSqlite()
    })
  });
  return kysely;
}

class SqlFileMigrationProvider implements MigrationProvider {
  async getMigrations() {
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
    const migrations: Record<string, Migration> = {};

    for (const file of files) {
      const name = path.basename(file, ".sql");
      const source = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");

      migrations[name] = {
        up: async (db) => {
          for (const statement of splitSqlStatements(source)) {
            await sql.raw(statement).execute(db);
          }
        }
      };
    }

    return migrations;
  }
}

export async function migrateDatabase() {
  const db = await getDb();
  const migrator = new Migrator({
    db,
    provider: new SqlFileMigrationProvider()
  });
  const result = await migrator.migrateToLatest();

  if (result.error) {
    throw result.error;
  }
}

export type { Database };
