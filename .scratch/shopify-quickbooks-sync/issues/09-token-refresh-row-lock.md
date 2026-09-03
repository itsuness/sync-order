# 09 — Token refresh under a row lock; failed refresh disconnects

Status: ready-for-agent
Blocked by: 03, 07

## Goal

At the start of processing a job, if the connection's `expires_at` is within
5 minutes of now, refresh the token first — holding
`SELECT ... FOR UPDATE` on the `connections` row so two jobs for the same
connection can't race Intuit's single-use rotating refresh token. A failed
refresh marks the connection `disconnected`, dead-letters the job, and stops
further claims for that connection.

## Scope

- `ensureFreshToken(connectionId, adapter, clock)`:
  - opens a transaction, `SELECT ... FOR UPDATE` the `connections` row;
  - if `expires_at - now > 5 min` → release, return the current token;
  - else call `adapter.refreshToken(...)`;
  - on success → persist new access/refresh tokens (encrypted) and new
    `expires_at`, commit, return the fresh token;
  - on failure → set `status = disconnected`, commit, return a typed
    error signalling "disconnect + dead-letter this job".
- The caller (ticket 11) turns that error into a `dead_letter` row and does
  not retry.
- Concurrent jobs for the same connection: the second waits on the lock,
  then sees the already-refreshed token and does not refresh again.
- 5-minute threshold is compared against the injected clock.

## Out of scope

- The OAuth reconnect flow itself (out of scope per spec — we do not test
  OAuth redirects; the dashboard surfaces the reconnect entry point in
  ticket 19).
- The worker loop that calls this (ticket 11).
- Handling a 401 mid-call (ticket 10 classifies it; ticket 11 routes it
  back through this function).

## Acceptance criteria

- `expires_at` more than 5 min out → no refresh call made.
- `expires_at` within 5 min → exactly one refresh call, tokens updated.
- Refresh failure → connection `status = disconnected`, job dead-lettered,
  no retry scheduled.
- After disconnect, `claimNextJob` (ticket 06) skips that connection's jobs.

## Tests to write (Testing Decision 4b)

- Row-locking concurrency: two concurrent jobs for the same connection,
  token near expiry — exactly one refresh happens; the other sees the fresh
  token. Real test Postgres, two transactions, fake adapter.
- Unit: threshold boundary (just over vs just under 5 min) with an injected
  clock.
- Integration: refresh failure sets `disconnected` and produces a
  `dead_letter` row.

## Traces to

- US 6 (5-minute check), US 7 (row lock vs rotating refresh token), US 8
  (failed refresh → disconnected, no further jobs).
- ADR-0003; `CONTEXT.md` "The path of one order" step 5; Testing
  Decision 4b.
