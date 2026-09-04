import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDb, migrateDb } from './client.js';
import { recordEventAndCreateJob } from './record-event.js';
import { events, syncJobs } from './schema.js';

const url = process.env.TEST_DATABASE_URL;
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

if (!url) {
  describe.skip('recordEventAndCreateJob [needs TEST_DATABASE_URL]', () => {
    it('skipped without a test database', () => {});
  });
} else {
  const { db, close } = createDb(url);

  const input = { provider: 'shopify' as const, topic: 'orders/create', event: { id: 1 } };

  describe('recordEventAndCreateJob', () => {
    beforeAll(async () => {
      await migrateDb(db, migrationsFolder);
    });

    beforeEach(async () => {
      // cascade, not ordered deletes: dead_letter/audit_log also reference
      // sync_jobs with no ON DELETE, and more of those rows will exist once
      // later tickets land.
      await db.execute(sql`truncate table sync_jobs, events cascade`);
    });

    afterAll(async () => {
      await close();
    });

    it('one new event produces exactly one pending job with the expected initial values', async () => {
      const eventId = `evt-${randomUUID()}`;

      const result = await recordEventAndCreateJob(db, { ...input, eventId });

      expect(result).toEqual({ ok: true });

      const eventRows = await db.select().from(events);
      expect(eventRows).toHaveLength(1);

      const jobRows = await db.select().from(syncJobs);
      expect(jobRows).toHaveLength(1);
      expect(jobRows[0]).toMatchObject({
        eventId: eventRows[0]?.id,
        status: 'pending',
        attempts: 0,
        externalRef: null,
        claimedAt: null,
      });
      expect(jobRows[0]?.nextRunAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('the same event delivered twice still leaves exactly one job', async () => {
      const eventId = `evt-${randomUUID()}`;

      const first = await recordEventAndCreateJob(db, { ...input, eventId });
      const second = await recordEventAndCreateJob(db, { ...input, eventId });

      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: false, reason: 'duplicate' });
      expect(await db.select().from(events)).toHaveLength(1);
      expect(await db.select().from(syncJobs)).toHaveLength(1);
    });
  });
}
