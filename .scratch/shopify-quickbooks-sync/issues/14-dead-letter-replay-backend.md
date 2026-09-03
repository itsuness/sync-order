# 14 — Dead-letter replay: one job back to pending

Status: ready-for-agent
Blocked by: 13

## Goal

The operator can send one dead-lettered job back to `pending`. This is the
only manual action in the system. One job at a time — no bulk endpoint.

## Scope

- An `apps/api` endpoint `replayDeadLetter(deadLetterId)` (behind the
  operator auth from ticket 17 when that lands; until then, guard by a
  simple check and note the follow-up):
  - loads the `dead_letter` row;
  - sets the associated `sync_jobs` row back to `status = pending`,
    `next_run_at = now`, `last_error` cleared, `claimed_at` null;
  - `attempts` is NOT reset (attempts never reset — `CONTEXT.md`);
  - stamps `dead_letter.replayed_at = now`;
  - is idempotent-safe: replaying an already-replayed row that is no longer
    `failed` is a no-op with a clear response, not a double-queue.
- Accepts exactly one id per call. No array, no "replay all".

## Out of scope

- The button / list UI (ticket 21).
- Re-running the job (the existing worker loop picks it up).
- Any change to attempt-ceiling behaviour — a replayed job that fails again
  follows the same classification rules and can re-dead-letter.

## Acceptance criteria

- Replaying a dead-lettered job: its `sync_jobs` row is `pending` with
  `next_run_at = now`, `attempts` unchanged, `dead_letter.replayed_at` set.
- The worker then claims and processes it normally.
- A second replay call on the same row does not create a duplicate queued
  job.

## Tests to write

- Integration: dead-letter a job, replay it, assert the `sync_jobs`
  transition and `replayed_at`. Then let the fake adapter succeed and
  assert the job reaches `done`.
- Integration: double replay is a safe no-op.

## Traces to

- US 21 (manually replay one dead-lettered job at a time from the
  dashboard).
- `CONTEXT.md` "Replay" (the only manual action); "Attempt" (never resets).
