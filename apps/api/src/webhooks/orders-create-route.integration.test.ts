import { createHmac, randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { createDb, events, migrateDb } from '@order-sync/shared/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

const url = process.env.TEST_DATABASE_URL;
const secret = 'integration-shopify-webhook-signing-secret';

// apps/api/src/webhooks -> repo-root/packages/shared/drizzle
const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../../../../packages/shared/drizzle');

if (!url) {
  describe.skip('shopify orders/create receiver [needs TEST_DATABASE_URL]', () => {
    it('skipped without a test database', () => {});
  });
} else {
  const logLines: string[] = [];
  const logStream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      logLines.push(chunk.toString('utf8'));
      cb();
    },
  });

  const { db, close } = createDb(url);
  const app = buildApp({
    db,
    shopifyWebhookSecret: secret,
    logger: { level: 'error', stream: logStream },
  });

  const sign = (body: string): string =>
    createHmac('sha256', secret).update(body).digest('base64');

  const signedHeaders = (body: string): Record<string, string> => ({
    'x-shopify-hmac-sha256': sign(body),
    'x-shopify-event-id': `evt-${randomUUID()}`,
    'x-shopify-topic': 'orders/create',
  });

  const post = (body: string, headers: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/webhooks/shopify/orders-create',
      headers: { 'content-type': 'application/json', ...headers },
      payload: body,
    });

  describe('shopify orders/create receiver', () => {
    beforeAll(async () => {
      await migrateDb(db, migrationsFolder);
      await app.ready();
    });

    beforeEach(async () => {
      logLines.length = 0;
      await db.delete(events);
    });

    afterAll(async () => {
      await app.close();
      await close();
    });

    it('verifies the signature, stores one event, and returns 200', async () => {
      const body = JSON.stringify({ id: 9001, total_price: '42.00' });
      const headers = signedHeaders(body);

      const res = await post(body, headers);

      expect(res.statusCode).toBe(200);
      const rows = await db.select().from(events);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.provider).toBe('shopify');
      expect(rows[0]?.eventId).toBe(headers['x-shopify-event-id']);
      expect(rows[0]?.topic).toBe('orders/create');
      expect(rows[0]?.payload).toEqual({ id: 9001, total_price: '42.00' });
    });

    it('is idempotent: the same delivery twice leaves one row and logs no error', async () => {
      const body = JSON.stringify({ id: 9002 });
      const headers = signedHeaders(body);

      const first = await post(body, headers);
      const second = await post(body, headers);

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(await db.select().from(events)).toHaveLength(1);
      expect(logLines).toHaveLength(0);
    });

    it('rejects a tampered body with 401 and writes nothing', async () => {
      const body = JSON.stringify({ id: 9003, total_price: '10.00' });
      const headers = signedHeaders(body);
      const tampered = JSON.stringify({ id: 9003, total_price: '999.00' });

      const res = await post(tampered, headers);

      expect(res.statusCode).toBe(401);
      expect(await db.select().from(events)).toHaveLength(0);
    });

    it('rejects a missing signature with 401 and writes nothing', async () => {
      const body = JSON.stringify({ id: 9004 });
      const headers = signedHeaders(body);
      delete headers['x-shopify-hmac-sha256'];

      const res = await post(body, headers);

      expect(res.statusCode).toBe(401);
      expect(await db.select().from(events)).toHaveLength(0);
    });

    it('rejects a signed delivery with no event id (400) and writes nothing', async () => {
      const body = JSON.stringify({ id: 9005 });
      const headers = signedHeaders(body);
      delete headers['x-shopify-event-id'];

      const res = await post(body, headers);

      expect(res.statusCode).toBe(400);
      expect(await db.select().from(events)).toHaveLength(0);
    });
  });
}
