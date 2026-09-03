import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The six tables from CONTEXT.md. Two constraints carry system behaviour and
 * are asserted by tests, not left to app code:
 *
 * - `UNIQUE(provider, event_id)` on `events` is the idempotency guard. A
 *   duplicate delivery fails this insert; the receiver returns 200 anyway.
 * - the `(status, next_run_at)` index on `sync_jobs` is what the claim query
 *   reads.
 *
 * Column sets follow CONTEXT.md "The tables" verbatim; the only additions are
 * the `id` primary keys other tables reference by foreign key.
 */

// `connected` | `disconnected` and the four job states are quoted verbatim
// from CONTEXT.md; the two providers are the only ones the spec names.
export const providerEnum = pgEnum('provider', ['shopify', 'quickbooks']);
export const connectionStatusEnum = pgEnum('connection_status', ['connected', 'disconnected']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'done', 'failed']);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: providerEnum('provider').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamptz('expires_at'),
  externalAccountId: text('external_account_id'),
  status: connectionStatusEnum('status').notNull().default('connected'),
});

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: providerEnum('provider').notNull(),
    eventId: text('event_id').notNull(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamptz('received_at').notNull().defaultNow(),
  },
  (table) => [unique('events_provider_event_id_key').on(table.provider, table.eventId)],
);

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    status: jobStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextRunAt: timestamptz('next_run_at').notNull().defaultNow(),
    lastError: text('last_error'),
    claimedAt: timestamptz('claimed_at'),
    externalRef: text('external_ref'),
  },
  (table) => [index('sync_jobs_status_next_run_at_idx').on(table.status, table.nextRunAt)],
);

export const deadLetter = pgTable('dead_letter', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => syncJobs.id),
  finalError: text('final_error').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  replayedAt: timestamptz('replayed_at'),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => syncJobs.id),
  direction: text('direction').notNull(),
  provider: providerEnum('provider').notNull(),
  endpoint: text('endpoint').notNull(),
  request: jsonb('request'),
  response: jsonb('response'),
  statusCode: integer('status_code'),
  durationMs: integer('duration_ms').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

export const fieldMappings = pgTable('field_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => connections.id),
  rules: jsonb('rules').notNull(),
});
