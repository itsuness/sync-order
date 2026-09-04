import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

/**
 * One postgres-js pool wrapped in a Drizzle client. The URL is passed in — no
 * ambient `process.env` read here; the caller hands over the value the env
 * schema (ticket 02) has already validated. `close` ends the pool.
 */
export function createDb(url: string): DbHandle {
  const sql = postgres(url, { onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { db, close: () => sql.end() };
}

/** Apply the checked-in migrations in `migrationsFolder` to `db`. */
export function migrateDb(db: Database, migrationsFolder: string): Promise<void> {
  return migrate(db, { migrationsFolder });
}
