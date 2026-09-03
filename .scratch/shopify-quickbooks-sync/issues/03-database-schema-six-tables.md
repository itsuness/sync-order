# 03 — Database schema: the six tables

Status: done
Blocked by: 01, 02

## Goal

Drizzle schema and migrations for the six tables named in `CONTEXT.md`, with
the two constraints that carry system behaviour: `UNIQUE(provider, event_id)`
on `events` and the `(status, next_run_at)` index on `sync_jobs`.

## Scope

- `connections` — provider, access_token, refresh_token (both encrypted at
  rest), expires_at, external_account_id (realmId for QuickBooks), status
  (`connected` | `disconnected`).
- `events` — provider, event_id, topic, payload jsonb, received_at.
  `UNIQUE(provider, event_id)` as a real database constraint.
- `sync_jobs` — event_id (FK to events), status
  (`pending` | `running` | `done` | `failed`), attempts, next_run_at,
  last_error, claimed_at, external_ref. Index on `(status, next_run_at)`.
- `dead_letter` — job_id, final error, payload, created_at, replayed_at.
- `audit_log` — job_id, direction, provider, endpoint, request jsonb,
  response jsonb, status_code, duration_ms, created_at.
- `field_mappings` — connection_id, rules jsonb.
- Drizzle migration files checked in. A documented command to apply them.
- Encryption-at-rest helper for the two token columns (uses the
  token-encryption key from ticket 02). Pure function + key in, no ambient
  env read.

## Out of scope

- Any query logic (claim, insert, reconcile) — later tickets.
- Seed data beyond what a migration needs.
- A seventh table. If something seems to need one, stop and ask.

## Acceptance criteria

- Migrations apply cleanly to an empty Postgres and are idempotent to
  re-run check (`drizzle-kit` up to date).
- Inserting two `events` rows with the same `(provider, event_id)` raises a
  unique-violation at the database, not from app code.
- `sync_jobs` has an index on `(status, next_run_at)` (verify in the
  generated SQL).
- Round-trip test: encrypt a token, store, read, decrypt → original value;
  ciphertext in the column is not the plaintext.

## Tests to write

- Unit: token encrypt/decrypt round-trip and that ciphertext != plaintext.
- Integration (against a real test Postgres): duplicate
  `(provider, event_id)` insert throws a unique-violation error.

## Traces to

- `CONTEXT.md` "The tables" (all six, verbatim column intent).
- Spec "Implementation Decisions": Tables — idempotency is a database
  constraint, not an application-level check.
- US 3, 4, 20 depend on these tables and constraints.

## Comments

### Done — 2026-09-03

Drizzle schema for the six tables in `packages/shared/src/db/schema.ts`,
migration `packages/shared/drizzle/0000_initial_schema.sql`, token cipher in
`packages/shared/src/crypto/token-cipher.ts`.

Verification:

- `docker compose up -d` (repo root) starts local Postgres on host `5433`
  with `ordersync` + `ordersync_test`.
- `pnpm --filter @order-sync/shared db:migrate` applies cleanly to an empty
  database; a second run is a no-op. `db:generate` reports "No schema
  changes" — drizzle-kit up to date.
- Generated SQL: `events_provider_event_id_key UNIQUE("provider","event_id")`
  and `sync_jobs_status_next_run_at_idx` on `(status, next_run_at)`.
- `TEST_DATABASE_URL=... pnpm test` → 17 passing, including: duplicate
  `(provider, event_id)` raises SQLSTATE 23505 from the constraint; a token
  encrypted, written to `connections.access_token`, read back (column is not
  the plaintext) and decrypted to the original; migrations re-run without
  error. Without `TEST_DATABASE_URL` the integration file self-skips.

Packages added (both cleared before install): `drizzle-orm`, `postgres`
(postgres-js driver), `drizzle-kit`.

Deviations from a strict reading of Scope, for review:

- Kept foreign keys on `dead_letter.job_id`, `audit_log.job_id`, and
  `field_mappings.connection_id` (the ticket names a FK only on
  `sync_jobs.event_id`). They are `ON DELETE no action`, matching "nothing is
  ever hard-deleted". Say if you want them dropped.
- Did **not** add `UNIQUE(provider)` on `connections`. It would enforce
  "one connection per provider" but the ticket says to ask first, and it
  could complicate the reconnect flow (ticket 19). Flag if you want it.
- `audit_log.direction` is plain `text`, not an enum — CONTEXT names the
  column but not its values.
