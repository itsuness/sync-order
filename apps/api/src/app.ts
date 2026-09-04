import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { shopifyOrdersCreateRoute } from './webhooks/orders-create-route.js';
import type { ShopifyWebhookOptions } from './webhooks/types.js';

export interface AppDeps extends ShopifyWebhookOptions {
  /** Overridable so a test can capture what the receiver logs. Defaults to on. */
  readonly logger?: FastifyServerOptions['logger'];
}

export function buildApp({ logger = true, ...deps }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  app.get('/health', async () => ({ status: 'ok' }));
  void app.register(shopifyOrdersCreateRoute, deps);

  return app;
}
