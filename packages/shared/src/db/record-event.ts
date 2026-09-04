import { z } from 'zod';

import type { Database } from './client.js';
import { events, syncJobs } from './schema.js';

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
 * Insert one raw provider delivery into `events` and, in the same database
 * transaction, create its `sync_jobs` row (`status = pending`, `attempts =
 * 0`, `next_run_at = now`, `external_ref = null` — all column defaults, so
 * the insert only needs `event_id`). One event produces exactly one job:
 * chosen over a second unique constraint on `sync_jobs` because the
 * transaction already gives atomicity for free — a duplicate
 * `(provider, event_id)` fails the `events` insert before the job insert
 * ever runs, and Postgres rolls the whole transaction back, so no job is
 * ever left dangling from a half-applied write. That's simpler to reason
 * about than a second constraint that has to stay in sync with the first.
 *
 * Both producer paths — the webhook receiver (ticket 04) and the backfill
 * (ticket 15) — call this one function, so the "exactly one job per event"
 * guarantee only has to be true in one place.
 */
export async function recordEventAndCreateJob(
  db: Database,
  input: {
    readonly provider: (typeof events.$inferInsert)['provider'];
    readonly eventId: string;
    readonly topic: string;
    readonly event: unknown;
  },
): Promise<RecordResult> {
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(events)
        .values({
          provider: input.provider,
          eventId: input.eventId,
          topic: input.topic,
          payload: input.event,
        })
        .returning({ id: events.id });

      if (!row) {
        throw new Error('events insert returned no row');
      }

      await tx.insert(syncJobs).values({ eventId: row.id });
    });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'duplicate' };
    }
    return { ok: false, reason: 'error', error };
  }
}
