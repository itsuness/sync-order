import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { decryptToken, encryptToken } from '../crypto/token-cipher.js';
import * as schema from './schema.js';

const url = process.env.TEST_DATABASE_URL;
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

if (!url) {
  describe.skip('schema [needs TEST_DATABASE_URL]', () => {
    it('skipped without a test database', () => {});
  });
} else {
  const sql = postgres(url, { onnotice: () => {} });
  const db = drizzle(sql, { schema });

  describe('schema', () => {
    beforeAll(async () => {
      await migrate(db, { migrationsFolder });
      await sql`truncate table connections, events cascade`;
    });

    afterAll(async () => {
      await sql.end();
    });

    it('applies migrations idempotently on a re-run', async () => {
      await expect(migrate(db, { migrationsFolder })).resolves.toBeUndefined();
    });

    it('rejects a duplicate (provider, event_id) at the database, not from app code', async () => {
      const row: typeof schema.events.$inferInsert = {
        provider: 'shopify',
        eventId: `evt-${randomUUID()}`,
        topic: 'orders/create',
        payload: { id: 1 },
      };

      await db.insert(schema.events).values(row);

      // Drizzle wraps the driver error; the Postgres unique-violation
      // (SQLSTATE 23505) is on `.cause`, raised by the named constraint.
      await expect(db.insert(schema.events).values(row)).rejects.toMatchObject({
        cause: { code: '23505', constraint_name: 'events_provider_event_id_key' },
      });

      expect(await db.select().from(schema.events)).toHaveLength(1);
    });

    it('stores connection tokens as ciphertext and round-trips them back', async () => {
      const key = 'integration-token-encryption-key-min-32-chars';
      const token = 'shpat_super_secret_access_token';

      await db.insert(schema.connections).values({
        provider: 'quickbooks',
        accessToken: encryptToken(token, key),
        refreshToken: encryptToken('refresh-token', key),
      });

      const rows = await db
        .select({ accessToken: schema.connections.accessToken })
        .from(schema.connections);
      expect(rows).toHaveLength(1);

      const stored = rows[0]?.accessToken ?? '';
      expect(stored).not.toContain(token);
      expect(decryptToken(stored, key)).toEqual({ ok: true, value: token });
    });
  });
}
