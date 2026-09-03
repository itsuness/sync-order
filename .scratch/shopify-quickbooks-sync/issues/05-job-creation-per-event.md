# 05 — Every stored event spawns exactly one job

Status: ready-for-agent
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
