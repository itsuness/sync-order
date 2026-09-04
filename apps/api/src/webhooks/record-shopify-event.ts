import { z } from 'zod';

import { events, type Database } from '@order-sync/shared/db';

/**
 * A Postgres unique-violation is SQLSTATE `23505`. postgres-js raises it with
 * `code` on the error; Drizzle re-wraps and puts the original on `.cause`.
 * Parsed, not cast, so a shape mismatch is a clean `false`.
 */
const pgError = z.object({ code: z.string() });
const wrappedPgError = z.object({ cause: pgError });

function isUniqueViolation(error: unknown): boolean {
  const direct = pgError.safeParse(error);
  if (direct.success && direct.data.code === '23505') {
    return true;
  }
  const wrapped = wrappedPgError.safeParse(error);
  return wrapped.success && wrapped.data.cause.code === '23505';
}

export type RecordResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'duplicate' }
  | { readonly ok: false; readonly reason: 'error'; readonly error: unknown };

/**
 * Insert one raw Shopify delivery into `events`. Idempotency is the
 * `UNIQUE(provider, event_id)` constraint, not a pre-check: a duplicate insert
 * comes back as `{ ok: false, reason: 'duplicate' }` and the receiver still
 * answers 200.
 */
export async function recordShopifyEvent(
  db: Database,
  input: { readonly eventId: string; readonly topic: string; readonly event: unknown },
): Promise<RecordResult> {
  try {
    await db.insert(events).values({
      provider: 'shopify',
      eventId: input.eventId,
      topic: input.topic,
      payload: input.event,
    });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'duplicate' };
    }
    return { ok: false, reason: 'error', error };
  }
}
