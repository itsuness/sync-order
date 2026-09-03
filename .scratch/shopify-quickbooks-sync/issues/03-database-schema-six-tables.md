# 03 — Database schema: the six tables

Status: ready-for-agent
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
