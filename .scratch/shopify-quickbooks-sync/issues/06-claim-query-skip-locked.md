# 06 — Claim query: two workers never claim the same job

Status: ready-for-agent
Blocked by: 03, 05

## Goal

A worker claims one pending, due job at a time with
`SELECT ... FOR UPDATE SKIP LOCKED`. Two workers running concurrently never
claim the same job.

## Scope

- A `claimNextJob()` function in `apps/api` (or a `worker` package if the
  scaffold put it there) that, in one transaction:
  - selects the oldest `sync_jobs` row where `status = pending` and
    `next_run_at <= now`, ordered by `(status, next_run_at)`, `LIMIT 1`,
    `FOR UPDATE SKIP LOCKED`;
  - sets it to `running`, stamps `claimed_at = now`;
  - returns the claimed job, or null if none is due.
- Skips connections that are `disconnected` (join or subquery) — a
  disconnected connection's jobs are not claimable (ties to ticket 09).
- No claim of a job whose `next_run_at` is in the future.

## Out of scope

- What happens after the claim — mapping, adapter call, backoff (ticket 11).
- Token refresh (ticket 09).
- A polling loop / scheduler (ticket 11 wires that).

## Acceptance criteria

- A single call claims the oldest due job and marks it `running`.
- A job with `next_run_at` in the future is not claimed.
- Jobs for a `disconnected` connection are not claimed.

## Tests to write

- Row-locking concurrency (Testing Decision 4a): two concurrent callers
  contending for one `sync_jobs` row — each job is claimed by exactly one
  caller, never both. Real test Postgres, two transactions.

## Traces to

- US 5 (two workers never claim the same job).
- US 8 (no further jobs claimed for a disconnected connection) — partial;
  the disconnect transition itself is ticket 09.
- `CONTEXT.md` "Claim"; Testing Decision 4a.
