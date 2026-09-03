# Token refresh takes a row lock; a failed refresh disconnects the connection

Intuit rotates the refresh token on every use — the old one is invalidated
immediately. Two jobs for the same connection claimed by concurrent workers
could both decide to refresh at once, and the second refresh would use an
already-rotated-out token and fail. The worker takes
`SELECT ... FOR UPDATE` on the `connections` row around the
check-and-refresh step, so only one job at a time can refresh a given
connection; the other waits for the lock and then sees the already-refreshed
token.

If the refresh call itself fails — refresh token expired or revoked — the
connection is marked `disconnected`, the job dead-letters immediately
(retrying won't fix a dead connection), and no further jobs are claimed for
that connection until the operator reconnects via the OAuth flow.

## Considered options

- An application-level mutex instead of a row lock — rejected, the row
  lock is free (Postgres already owns the row) and survives a worker crash
  without extra bookkeeping.
- Letting every job attempt its own refresh and treating refresh failure as
  a normal retryable error — rejected, this hides a connection-level
  problem behind job-level noise across every in-flight job for that
  connection.
