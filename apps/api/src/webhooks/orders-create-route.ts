import { recordEventAndCreateJob } from '@order-sync/shared/db';
import type { FastifyPluginAsync } from 'fastify';

import { verifyShopifyHmac } from './shopify-hmac.js';
import type { ShopifyWebhookOptions } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

function header(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * The Shopify `orders/create` receiver: verify the HMAC over the raw bytes,
 * store the event, create its `sync_jobs` row (ticket 05, same transaction as
 * the event insert), return 200. It never calls QuickBooks — that stays the
 * worker's job. A duplicate delivery still returns 200 and creates no job.
 */
export const shopifyOrdersCreateRoute: FastifyPluginAsync<ShopifyWebhookOptions> = async (
  app,
  opts,
) => {
  // Scoped to this plugin: HMAC is checked against the exact bytes, so the body
  // is handed to the route as a raw Buffer and parsed only after the signature
  // passes (US 1 — nothing happens before HMAC). `/health` on the root instance
  // keeps the default JSON parser.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(body);
    req.rawBody = raw;
    done(null, raw);
  });

  app.post('/webhooks/shopify/orders-create', async (req, reply) => {
    const { rawBody } = req;
    const signature = header(req.headers['x-shopify-hmac-sha256']);
    if (rawBody === undefined || signature === undefined) {
      return reply.code(401).send();
    }
    if (!verifyShopifyHmac(rawBody, signature, opts.shopifyWebhookSecret)) {
      return reply.code(401).send();
    }

    const eventId = header(req.headers['x-shopify-event-id']);
    const topic = header(req.headers['x-shopify-topic']);
    if (eventId === undefined || topic === undefined) {
      return reply.code(400).send();
    }

    let event: unknown;
    try {
      event = rawBody.length > 0 ? JSON.parse(rawBody.toString('utf8')) : null;
    } catch {
      return reply.code(400).send();
    }

    const result = await recordEventAndCreateJob(opts.db, {
      provider: 'shopify',
      eventId,
      topic,
      event,
    });

    if (result.ok || result.reason === 'duplicate') {
      return reply.code(200).send();
    }

    req.log.error({ err: result.error }, 'failed to store shopify orders/create event');
    return reply.code(500).send();
  });
};
