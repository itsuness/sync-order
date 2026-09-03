# Retry policy: classify failures, widen the retryable budget

The original backoff (`now + 2^attempts` minutes, 5 attempts) treats every
failure the same, but a QuickBooks outage and a permanently unmappable
order aren't the same problem — one resolves on its own, the other never
will. We split failures into two classes: 5xx, timeouts, network errors,
and 429 are **retryable** and get an extended budget (backoff capped at 60
minutes, up to 10 attempts, ~8 hours of coverage — enough to ride out a
multi-hour outage without manual replay). Any other 4xx (except 401, which
is a token problem handled by refresh, not a data problem) is
**non-retryable** and dead-letters on the first attempt, since retrying a
bad payload just delays the operator noticing.

## Consequences

- Dead-letter now means one of two things: "this data is broken" (1
  attempt) or "QuickBooks stayed down longer than 8 hours" (10 attempts) —
  `last_error` on the dead-lettered job tells you which.
- A 3-hour outage self-heals without ever touching dead-letter or replay.

## Considered options

- Keep a single uniform policy for every failure — rejected, it either
  dead-letters real outages too eagerly or retries broken data pointlessly.
