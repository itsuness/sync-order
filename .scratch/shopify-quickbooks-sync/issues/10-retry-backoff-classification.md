# 10 — Retry classification and backoff calculation (pure)

Status: ready-for-agent
Blocked by: 07

## Goal

A pure module that, given a failure and the current attempt count, decides:
retry or dead-letter, and if retry, when. No I/O, no clock read — `now` is
passed in.

## Scope

- `classify(error): 'retryable' | 'non-retryable' | 'refresh'`
  - retryable: 5xx, timeout, network error, 429;
  - `refresh`: HTTP 401;
  - non-retryable: any other 4xx.
- `nextRunAt(attempts, now, retryAfter?)`:
  - base backoff `now + 2^attempts` minutes, capped at 60 minutes;
  - if `retryAfter` is present (from a 429), it overrides the calculation
    entirely (respect `Retry-After` in seconds or an HTTP-date).
- `shouldDeadLetter(classification, attempts)`:
  - non-retryable → dead-letter after 1 attempt;
  - retryable → dead-letter after 10 attempts (~8 hours of coverage with
    the 60-min cap);
  - `refresh` → never dead-letters here; it routes to ticket 09's
    ensure-fresh-token path and retries.
- Attempts only ever increase; this module never resets them.

## Out of scope

- Applying the decision to `sync_jobs` / `dead_letter` rows (ticket 11).
- Making the HTTP call or producing the error (ticket 12).
- The 401→refresh mechanics (ticket 09).

## Acceptance criteria

- `2^attempts` minutes for attempts 0..5, then flat 60 min from the attempt
  where it would exceed 60.
- A 429 with `Retry-After: 120` schedules exactly 120s out regardless of
  attempt count.
- 500 / timeout / network / 429 classify retryable; 400/403/404/409
  non-retryable; 401 → `refresh`.
- Retryable dead-letters at attempt 10, non-retryable at attempt 1.

## Tests to write (Testing Decision 3)

Unit tests against the calculation functions (no live QuickBooks call):
- backoff curve including the 60-min cap;
- `Retry-After` override (seconds form and HTTP-date form);
- the retryable / non-retryable / 401 split across a table of status codes
  and error categories;
- dead-letter thresholds at 1 and 10.

## Traces to

- US 15 (retryable backs off and retries), US 16 (`Retry-After` override),
  US 17 (non-retryable dead-letters after one attempt), US 18 (~8h budget),
  US 19 (401 → refresh + retry, not dead-letter).
- ADR-0002; `CONTEXT.md` "Backoff" / "Dead letter"; Testing Decision 3.
