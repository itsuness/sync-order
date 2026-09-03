import { loadApiEnv } from '@order-sync/shared';

import { buildApp } from './app.js';

const env = loadApiEnv();
const app = buildApp();

app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});
