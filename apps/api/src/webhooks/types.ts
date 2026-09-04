import type { Database } from '@order-sync/shared/db';

/** What the API process hands to the webhook plugin (and, today, the whole app). */
export interface ShopifyWebhookOptions {
  readonly db: Database;
  readonly shopifyWebhookSecret: string;
}
