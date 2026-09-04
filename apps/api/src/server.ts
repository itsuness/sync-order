import { loadApiEnv } from '@order-sync/shared';
import { createDb } from '@order-sync/shared/db';

import { buildApp } from './app.js';

const env = loadApiEnv();
const { db } = createDb(env.DATABASE_URL);
const app = buildApp({ db, shopifyWebhookSecret: env.SHOPIFY_WEBHOOK_SECRET });

app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});
