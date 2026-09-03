# CONTEXT.md

Shared language for this repo. Read this before writing code or asking me
questions. Use these terms exactly. Do not invent synonyms.

---

## What this is

A one-way sync engine. Shopify orders become QuickBooks Online invoices.

It exists to make three failures impossible to miss and cheap to fix:

1. **Duplicate** — the same order becomes two invoices.
2. **Loss** — an order never reaches QuickBooks because the API was down,
   the token expired, or a rate limit was hit, and nobody noticed.
3. **Drift** — the totals in the two systems stop matching and nobody finds
   out until the accountant does.

Single-tenant. One operator. Portfolio project, production behaviour.

## The one rule

**The receiver never calls QuickBooks. Only the worker does.**

The webhook receiver verifies the signature, writes the raw event, and
returns 200. Nothing else. Every external call happens later, from the
queue, in the worker.

This rule is what makes retries, replay, and idempotency possible. If a
change seems to require breaking it, the change is wrong. Say so instead
of breaking the rule.

## Vocabulary

Use these words. They mean exactly this and nothing else.

**Event** — one raw inbound payload from a provider, stored exactly as
received. An event is a fact that already happened. It is never edited.

**Event ID** — the provider's own identifier for a delivery
(`X-Shopify-Event-Id`). Unique per provider. The basis of idempotency.

**Job** — one unit of work derived from one event. A job has a status and
an attempt count. Jobs are the only thing the worker acts on.

**Claim** — the worker taking ownership of a pending job, using
`SELECT ... FOR UPDATE SKIP LOCKED`. Two workers must never claim the same job.

**Attempt** — one execution of a job. Attempts increase. They never reset.

**Backoff** — the delay before the next attempt. Retryable failures (5xx,
timeout, network error, 429): `now + 2^attempts` minutes, capped at 60
minutes. A 429 response overrides this with the provider's `Retry-After`.
See ADR-0002.

**Dead letter** — a job that stopped retrying and waits for a human.
Non-retryable failures (any 4xx except 401) dead-letter after 1 attempt;
retryable failures (5xx, timeout, network error, 429) dead-letter after 10.
Nothing is deleted. See ADR-0002.

**Replay** — the operator sending a dead-lettered job back to `pending`.
The only manual action in the system.

**Mapper** — a pure function. Shopify order in, QuickBooks invoice JSON out.
No network, no database, no clock. This is the part that is unit-tested and
the part that changes per client.

**Adapter** — the object that talks to one external system. It implements a
fixed interface. QuickBooks is one adapter. Adding Xero later means adding
an adapter file, not editing the worker.

**Connection** — stored credentials for one external system: tokens, expiry,
account identifier, and a `status` (`connected` | `disconnected`).
QuickBooks connections also carry a `realmId`. A refresh failure sets
`status` to `disconnected` until the operator reconnects. See ADR-0003.

**Backfill** — importing historic orders by paging the provider API. It
writes the same events as the webhook path. Different producer, same table.

**Cursor** — the saved position in a backfill. If the backfill crashes at
page 40, it restarts at page 40.

**Reconciliation** — comparing Shopify order totals against QuickBooks
invoice totals fetched live from QuickBooks for a date range (not against
our own `sync_jobs`), reporting each order as `matched` (exact-cent equal
on grand total), `refunded` (the order has a Shopify refund — expected,
needs a credit memo, not a resync), or `drift` (unexplained mismatch).
This is the screen that proves the engine works. See ADR-0004.

**Break-it** — the demo panel. It forces the next adapter call to return a
429, a 500, or an expired token, so a viewer can watch the system recover.

**Operator** — the single human user. Not a customer, not a tenant.

## Words we do not use

- "Sync" as a verb for a single record. Say "create the invoice".
- "Message" or "task". Say **event** or **job**.
- "Queue service". The queue is a Postgres table.
- "Retry queue". Failed jobs stay in `sync_jobs` until dead-lettered.
- "User". Say **operator**.

## The tables

Six. Nothing else without asking.

**`connections`** — one row per external system. provider, access_token and
refresh_token encrypted at rest, expires_at, external_account_id (realmId
for QuickBooks), status.

**`events`** — the raw log. provider, event_id, topic, payload jsonb,
received_at. **`UNIQUE(provider, event_id)`** is the idempotency guard.
A duplicate delivery fails this insert and the receiver returns 200 anyway.
Do not replace this with an application-level check.

**`sync_jobs`** — the queue. event_id, status
(`pending` | `running` | `done` | `failed`), attempts, next_run_at,
last_error, claimed_at, external_ref (the QuickBooks invoice id after
success). Indexed on `(status, next_run_at)`.

**`dead_letter`** — job_id, final error, payload, created_at, replayed_at.

**`audit_log`** — job_id, direction, provider, endpoint, request jsonb,
response jsonb, status_code, duration_ms, created_at. Every external write
lands here. This is what makes the numbers trustworthy.

**`field_mappings`** — per-connection rules as jsonb. The mapper reads these.
Client-specific behaviour lives here, not in code.

## The path of one order

1. Shopify sends `orders/create` to the receiver.
2. Receiver verifies the HMAC, inserts an event, returns 200.
3. A job is created for that event, `pending`.
4. The worker claims the job.
5. The worker refreshes the token if it expires within 5 minutes, holding a
   row lock on `connections` while it does (ADR-0003).
6. The mapper turns the order into invoice JSON.
7. The adapter checks QuickBooks for an existing invoice with this order's
   `DocNumber` (ADR-0001), then calls QuickBooks. The call is written to
   `audit_log`.
8. Success: job `done`, external_ref saved. Failure: attempts + 1, backoff.
   Fifth failure: dead letter.

## Decisions already made — do not reopen

- Idempotency is a database constraint, not application logic.
- The queue is Postgres, not Redis or BullMQ.
- The mapper is pure. All I/O stays in the worker and the adapter.
- Retries are at-least-once delivery with an idempotent write target.
- Nothing is ever hard-deleted. Failures are kept and shown.
- QuickBooks writes are idempotent via a deterministic `DocNumber` and a
  query-before-create check (ADR-0001).
- Failures are retryable (5xx, timeout, network, 429) or not (any other
  4xx); only retryable failures get the extended backoff budget (ADR-0002).
- Token refresh takes a row lock on `connections`; a failed refresh
  disconnects the connection and dead-letters the job (ADR-0003).
- Reconciliation compares live QuickBooks data, not `sync_jobs` (ADR-0004).
- Dead-letter replay is manual, one job at a time, from the web dashboard.
  No bulk replay.

## Open questions

Keep this list current. Add to it when we defer a decision.

- Do we sync order updates, or only creation? (Currently: creation only.)
