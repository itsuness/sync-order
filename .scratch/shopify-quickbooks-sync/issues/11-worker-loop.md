# 11 — Worker loop: claim → refresh → map → adapter → audit → settle

Status: ready-for-agent
Blocked by: 06, 08, 09, 10

## Goal

Tie the worker pieces together into one processing step, driven against the
adapter *interface* (the fake), so the real QuickBooks adapter (ticket 12)
drops in without loop changes.

## Scope

- `processOneJob(deps)`:
  1. `claimNextJob()` (06); if none, return idle.
  2. Load the job's connection; `ensureFreshToken` (09). A disconnect error
     → write `dead_letter`, mark job `failed`, stop.
  3. Load `field_mappings` for the connection; run the mapper (08). A
     mapper error → non-retryable → `dead_letter`, job `failed`.
  4. Call the adapter: `findInvoiceByDocNumber` then `createInvoice` if
     absent (the query-before-create sequence lives in the adapter for the
     real one; the loop just calls the interface).
  5. Every adapter call's request/response/status/duration → `audit_log`
     (the loop owns writing the audit row from what the adapter returns).
  6. Success → job `done`, `external_ref` saved, `attempts` unchanged.
  7. Failure → `classify` + `nextRunAt` + `shouldDeadLetter` (10):
     - retry → `attempts += 1`, `status = pending`, `next_run_at` set,
       `last_error` set;
     - dead-letter → `dead_letter` row, job `status = failed`;
     - `refresh` (401) → route back through `ensureFreshToken`, then retry
       the job on the next tick (no attempt burned for the 401 itself,
       per ADR-0002 / US 19 — document the exact bookkeeping in a comment).
- A thin runner that calls `processOneJob` in a loop with a sleep when
  idle. The runner is not unit-tested (framework wiring).
- A job stuck in `running` past a threshold (crashed worker) is returned to
  `pending` — pick a simple reclaim rule and document it.

## Out of scope

- Real QuickBooks HTTP (ticket 12).
- The break-it fault hook (ticket 22) — but call the adapter through a seam
  that ticket can wrap.
- Dashboard views (18–22).

## Acceptance criteria

- Happy path against the fake adapter: pending job → `done` with
  `external_ref`, one `audit_log` row.
- Fake adapter returns 500 → job back to `pending`, `attempts = 1`,
  `next_run_at` in the future, `last_error` set, one `audit_log` row.
- Fake adapter returns 400 → `dead_letter` row, job `failed`.
- Fake adapter returns 401 → refresh path invoked, job retried, no
  dead-letter.
- `findInvoiceByDocNumber` returns an existing invoice → job `done` with
  that `external_ref`, no create call.

## Tests to write

- Integration (test Postgres + fake adapter) for each acceptance bullet
  above. These exercise the state transitions, not the framework.

## Traces to

- `CONTEXT.md` "The path of one order" steps 4–8; US 13, 14 (query-before-
  create is invoked here, audit row written here).
- Consumes tickets 06/08/09/10; ADR-0001, ADR-0002, ADR-0003.
