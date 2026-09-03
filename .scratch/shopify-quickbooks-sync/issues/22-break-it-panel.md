# 22 — Break-it panel: force the next adapter call to fail

Status: ready-for-agent
Blocked by: 11, 17

## Goal

A dashboard control that forces the next adapter call to return a 429, a
500, or an expired token, so the operator (or a demo audience) can watch the
retry and recovery behaviour happen live.

## Scope

- A fault-injection seam around the adapter call in the worker loop
  (ticket 11 was built with this seam in mind): before a call, check for a
  pending armed fault; if present, consume it and make the adapter (or the
  seam) produce that failure instead of a real call.
- Fault storage: the simplest correct mechanism that needs no seventh table
  — e.g. a single-row config, or an in-memory flag on the worker if the
  worker is a single process. Document the choice and its limitation.
- Three fault types:
  - `http-429` — surfaces a `Retry-After` so the operator sees the override
    (ties to US 16);
  - `http-500` — retryable, backs off and retries (US 15);
  - `expired-token` — makes the connection's token look expired / a 401 on
    the call, so the refresh path runs (US 6 / US 19).
- The panel: three buttons to arm a fault, a visible "armed" indicator, and
  a way to disarm. Guarded by ticket 17.
- Arming a fault affects exactly one subsequent adapter call, then clears.

## Out of scope

- Any use in production data flow beyond the demo (it's a demo tool).
- Persisting fault history.
- Faults for the Shopify side — this is about the accounting adapter.

## Acceptance criteria

- Arm `http-500`, trigger a job → the job records attempt +1, a backoff
  `next_run_at`, an `audit_log` row, then succeeds on the next real attempt.
- Arm `http-429` with a `Retry-After` → `next_run_at` matches the
  `Retry-After`, not the `2^attempts` curve.
- Arm `expired-token` → the token-refresh path runs before the retry; on a
  seeded-good refresh the job then succeeds.
- A fault clears after one call; a second job is unaffected unless re-armed.

## Tests to write

- Integration (fake adapter + the seam): each armed fault produces the
  expected job transition. These overlap ticket 11's tests but assert the
  arming/consuming behaviour specifically.

## Traces to

- US 27 (break-it panel forcing 429 / 500 / expired token to demo
  retry/recovery live).
- `CONTEXT.md` "Break-it"; Spec "Implementation Decisions": Break-it panel.
