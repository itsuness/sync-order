# 05 — Every stored event spawns exactly one job

Status: done
Blocked by: 03, 04

## Goal

Each row written to `events` produces exactly one `sync_jobs` row in
`pending`. The queue's job count always traces back to a real, deduplicated
event.

## Scope

- Job creation happens in the same database transaction as the `events`
  insert (ticket 04), or is otherwise guaranteed exactly-once per event —
  pick the simpler correct option and note why in a comment.
- New `sync_jobs` row: `event_id` set, `status = pending`, `attempts = 0`,
  `next_run_at = now`, `external_ref` null.
- A duplicate event delivery (which does not insert an `events` row) must
  not create a second job.
- Backfill-written events (ticket 15) go through the same job-creation path.

## Out of scope

- Claiming or running the job (ticket 06+).
- Any retry/backoff fields beyond the initial values.

## Acceptance criteria

- One new event → exactly one `pending` job.
- Same event delivered twice → still exactly one job.
- `sync_jobs.event_id` references the `events` row.

## Tests to write

- Integration: insert an event, assert one `pending` job with the expected
  initial field values. Deliver the same event again, assert still one job.

## Traces to

- US 4 (every stored event → exactly one queue job).
- `CONTEXT.md` "The path of one order" step 3.

## Comments

### Done — 2026-09-04

`packages/shared/src/db/record-event.ts` — `recordEventAndCreateJob(db,
{ provider, eventId, topic, event })`: inserts `events` and `sync_jobs` in
one `db.transaction()`. Chose the transaction over a second unique
constraint on `sync_jobs` because it gives atomicity for free — a duplicate
`(provider, event_id)` fails the `events` insert before the job insert ever
runs, and Postgres rolls the whole transaction back, so no job is ever left
dangling from a half-applied write. `sync_jobs` needs no explicit values
beyond `event_id`; `status`, `attempts`, `next_run_at`, `external_ref` are
all column defaults already (schema.ts, ticket 03).

Both current and future producer paths call this one function: the Shopify
webhook route (`apps/api/src/webhooks/orders-create-route.ts`, ticket 04)
now calls it directly with `provider: 'shopify'` — the old
`record-shopify-event.ts` wrapper was removed since it had exactly one
caller and added nothing over calling the shared function inline. Ticket 15
(backfill) should call the same function.

Verification (2026-09-04, `docker compose up -d`):

- `pnpm -r typecheck` clean.
- `TEST_DATABASE_URL=postgres://ordersync:ordersync@localhost:5433/ordersync_test pnpm test`
  → 29 passed, run repeatedly. New/changed coverage:
  - `packages/shared/src/db/record-event.integration.test.ts` (new,
    Tests-to-write above): one new event → exactly one `pending` job with
    the expected `event_id`/`status`/`attempts`/`external_ref`/`claimed_at`/
    `next_run_at`; same event delivered twice → still exactly one job.
  - `orders-create-route.integration.test.ts`: extended the existing
    "new event" and "duplicate delivery" cases to also assert on
    `sync_jobs`.

Deviation, for review: `vitest.config.ts` gained `fileParallelism: false`.
Three integration test files now share one Postgres test database and each
truncates/counts whole tables; running files in parallel (Vitest's default)
raced them against each other and produced flaky, sometimes-2-rows
failures. Serializing all test files is the simpler fix over scoping it to
just the `*.integration.test.ts` files (Vitest project/workspace split) —
the whole suite still runs in ~4s at this size. Flag if that stops being
true.

Also fixed while here: the webhook integration test's `beforeEach` cleared
state with `db.delete(syncJobs)` then `db.delete(events)`, ordered around
today's one FK — `dead_letter`/`audit_log` also reference `sync_jobs`/
`events` with no cascade and will start being populated by later tickets,
which would break this ordering. Switched both integration tests that touch
these tables to `truncate table ... cascade`.
