# 13 — Dead-letter persistence: kept, never deleted

Status: ready-for-agent
Blocked by: 03, 11

## Goal

A job that stops retrying lands in `dead_letter` with its final error and
the payload that produced it, and is never hard-deleted.

## Scope

- The write path (called from ticket 11's settle step): insert a
  `dead_letter` row with `job_id`, final error text, the event payload,
  `created_at`. `replayed_at` left null.
- The originating `sync_jobs` row stays (status `failed`), not deleted — so
  Activity (ticket 18) can still show the job's history.
- A read function `listDeadLetters()` returning rows newest-first with
  enough to render ticket 21's UI (job id, order reference, final error,
  created_at, replayed_at).
- No delete function anywhere. A `grep` for `DELETE FROM dead_letter` /
  `.delete(` on that table should find nothing.

## Out of scope

- The replay action (ticket 14).
- The dashboard UI (ticket 21).
- Bulk operations of any kind (explicitly out of scope in the spec).

## Acceptance criteria

- A dead-lettering job (from either the 1-attempt or 10-attempt path)
  produces exactly one `dead_letter` row with the final `last_error` and
  the event payload.
- The `sync_jobs` row still exists afterwards with `status = failed`.
- No code path deletes from `dead_letter`.

## Tests to write

- Integration: drive a job to dead-letter via the fake adapter (400 once,
  and separately 500 x10), assert one `dead_letter` row each with the
  expected error and payload, and the `sync_jobs` row retained.

## Traces to

- US 20 (dead-lettered jobs kept, never deleted, with final error and
  payload).
- `CONTEXT.md` "Dead letter"; "Decisions already made": nothing is ever
  hard-deleted.
