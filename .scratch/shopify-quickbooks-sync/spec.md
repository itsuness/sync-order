# Shopify → QuickBooks order sync engine

Status: ready-for-agent

## Problem Statement

The operator runs a Shopify store and books through QuickBooks Online.
Right now, getting an order from Shopify into QuickBooks as an invoice is
either manual or happens through nothing at all — there's no way to be
sure every order became exactly one invoice, no way to tell whether
QuickBooks silently missed one during an outage or an expired token, and
no way to know, without opening both systems and cross-checking by hand,
whether the numbers in Shopify and QuickBooks actually agree. Small
mistakes here are expensive: a duplicate invoice overstates revenue, a
missed order understates it, and drift nobody notices until the accountant
does costs real time to unwind.

## Solution

A one-way sync engine: Shopify order webhooks land as raw, immutable
events; each event becomes a durable job on a Postgres-backed queue; a
worker claims jobs one at a time, refreshes QuickBooks credentials as
needed, maps the order to an invoice, and writes it to QuickBooks through
an idempotent, retrying adapter. Every external call is logged. Failures
that can resolve themselves (QuickBooks being down) retry on a backoff;
failures that can't (bad data, a dead connection) stop immediately and wait
for the operator. A reconciliation screen compares live QuickBooks data
against Shopify order totals on demand, so drift is something the operator
can see and act on, not something they discover months later.

## User Stories

1. As the operator, I want every Shopify `orders/create` webhook verified
   by HMAC signature before anything else happens, so that forged requests
   never create jobs or invoices.
2. As the operator, I want the webhook receiver to do nothing but verify,
   store the raw event, and return 200, so that a slow or failing
   QuickBooks call never causes Shopify to consider the webhook delivery
   failed.
3. As the operator, I want the same Shopify event delivered twice to
   produce exactly one stored event and no error at the receiver, so that
   Shopify's at-least-once delivery guarantee can't create a duplicate
   invoice.
4. As the operator, I want every stored event to spawn exactly one queue
   job, so that the queue's job count always traces back to a real,
   deduplicated event.
5. As the operator, I want two worker processes to never claim the same
   job, so that running more than one worker is safe and doesn't risk a
   double-send to QuickBooks.
6. As the operator, I want the worker to check whether the QuickBooks
   access token expires within 5 minutes and refresh it first if so, so
   that a job never fails mid-call purely because the token happened to
   expire during processing.
7. As the operator, I want token refresh for one connection to take a
   database row lock, so that two jobs for the same connection can't both
   try to refresh at once and race against Intuit's single-use, rotating
   refresh token.
8. As the operator, I want a failed token refresh to mark the connection
   `disconnected` and stop the worker from claiming any further jobs for
   it, so that a dead connection produces one clear signal instead of every
   queued job failing individually.
9. As the operator, I want a `disconnected` connection to be visibly
   flagged in the dashboard with a way to reconnect, so that I know
   immediately when QuickBooks access has lapsed and how to fix it.
10. As the operator, I want the order-to-invoice mapping to be a pure
    function with no network, database, or clock access, so that it can be
    fully unit-tested and is the one piece safe to change per client
    without touching the worker or adapter.
11. As the operator, I want the mapper to correctly carry over tax,
    discounts, and a customer that already exists in QuickBooks, so that
    invoices reflect what was actually charged and don't create duplicate
    customer records.
12. As the operator, I want per-connection field mapping rules stored as
    data (`field_mappings`), so that client-specific mapping behavior lives
    in configuration, not in code that has to be redeployed.
13. As the operator, I want the adapter to derive a deterministic
    `DocNumber` from the Shopify order id and check QuickBooks for an
    existing invoice with that `DocNumber` before creating one, so that a
    retried job after a crash can't create a second invoice for the same
    order.
14. As the operator, I want every QuickBooks API call — request, response,
    status code, and duration — written to an audit log, so that I can
    prove exactly what was sent and received for any invoice without
    guessing.
15. As the operator, I want a failure classified as retryable (5xx,
    timeout, network error, 429) to back off and try again automatically,
    so that a temporary QuickBooks problem resolves itself without my
    involvement.
16. As the operator, I want a 429 response's `Retry-After` header to
    override the normal backoff calculation, so that the worker respects
    QuickBooks' own rate-limit guidance instead of guessing.
17. As the operator, I want a failure classified as non-retryable (any 4xx
    except 401) to dead-letter after a single attempt, so that a
    permanently broken order doesn't waste five retries before I find out
    about it.
18. As the operator, I want retryable failures to keep retrying for up to
    roughly 8 hours (capped backoff, raised attempt ceiling) before
    dead-lettering, so that a multi-hour QuickBooks outage resolves on its
    own instead of dumping every order from that window into dead-letter.
19. As the operator, I want a 401 response to trigger a token refresh and
    retry rather than an immediate dead-letter, so that an unexpectedly
    stale token doesn't get treated as a permanently broken order.
20. As the operator, I want dead-lettered jobs kept, never deleted, with
    their final error and payload, so that I can see exactly what went
    wrong and decide what to do about it.
21. As the operator, I want to manually replay one dead-lettered job at a
    time from the Next.js dashboard, so that I stay in control of what
    gets resent to QuickBooks after a failure.
22. As the operator, I want historic Shopify orders importable via a
    backfill that pages the provider API and writes the same events table
    the webhook path writes, so that connecting a store for the first time
    doesn't leave a gap of un-synced history.
23. As the operator, I want a backfill that crashes at page 40 to resume at
    page 40 using a saved cursor, so that a failure partway through doesn't
    mean starting the import over.
24. As the operator, I want a reconciliation screen that compares Shopify
    order totals against invoices fetched live from QuickBooks for a date
    range, so that the comparison reflects reality even if an invoice was
    edited or deleted directly in QuickBooks after the sync ran.
25. As the operator, I want reconciliation to use exact-cent equality on
    the grand total (tax, shipping, and discounts included), so that a
    genuine one-cent mismatch is surfaced rather than silently rounded
    away.
26. As the operator, I want an order with a Shopify refund to show as
    `refunded` in reconciliation rather than `drift`, so that I can
    immediately tell "this needs a credit memo" apart from "something is
    actually broken."
27. As the operator, I want a "break-it" panel that forces the next
    adapter call to return a 429, a 500, or an expired token, so that I —
    or anyone I'm demoing this to — can watch the retry and recovery
    behavior happen live instead of taking it on faith.
28. As the operator, I want a single hardcoded login for the dashboard, so
    that the system is protected without building out user accounts I
    don't need.
29. As the operator, I want an Activity view in the dashboard showing the
    path of each order — event received, job claimed, invoice created or
    failed — so that I can answer "what happened to this order" without
    querying the database directly.
30. As the operator, I want all required secrets (API keys, tokens,
    encryption keys) validated by a Zod schema at process boot, with a
    loud exit if any are missing, so that a misconfigured deployment fails
    immediately and obviously rather than failing silently on the first
    real order.

## Implementation Decisions

**Tables (six, per CONTEXT.md — no others without asking):**
`connections`, `events`, `sync_jobs`, `dead_letter`, `audit_log`,
`field_mappings`. `events` carries the `UNIQUE(provider, event_id)`
constraint that is the idempotency guard; it is a database constraint, not
an application-level check.

**Connection status:** `connected` | `disconnected`. A refresh failure sets
`disconnected`, at which point no further jobs are claimed for that
connection until the operator reconnects via OAuth (ADR-0003).

**Token refresh:** triggered when `expires_at` is within 5 minutes of now,
checked once at the start of job processing, inside a `SELECT ... FOR
UPDATE` lock on the `connections` row so concurrent jobs for the same
connection can't race Intuit's single-use rotating refresh token
(ADR-0003).

**Adapter interface:** the worker only knows the adapter's shared
interface, never that it's talking to QuickBooks specifically — adding
Xero later means adding an adapter, not editing the worker. The QuickBooks
adapter derives `DocNumber` as `SHOP-{order_id}` and checks for an existing
invoice with that `DocNumber` before creating one, returning the existing
`external_ref` on a match instead of creating a duplicate (ADR-0001).

**Retry classification (ADR-0002):**
- Retryable: 5xx, timeout, network error, 429. Backoff is
  `now + 2^attempts` minutes, capped at 60 minutes; up to 10 attempts
  (~8 hours) before dead-letter. A 429's `Retry-After` overrides the
  calculated backoff.
- Non-retryable: any 4xx except 401. Dead-letters after 1 attempt.
- 401: treated as an expired-token signal — triggers a refresh and retry,
  not a dead-letter.

**Reconciliation (ADR-0004):** queries QuickBooks live for invoices in a
date range and joins to `sync_jobs` by `external_ref` — not a comparison
against `sync_jobs` alone. Three outcomes per order: `matched` (exact-cent
equal on grand total, integer minor units, no tolerance), `refunded` (the
Shopify order has a refund — expected, not a bug), `drift` (unexplained
mismatch).

**Backfill:** pages the provider API and writes into the same `events`
table the webhook path writes to — different producer, same idempotency
guard. Progress is tracked via a saved cursor so a crash resumes rather
than restarts.

**Dead-letter replay:** manual, one job at a time, from the Next.js
dashboard. No bulk replay endpoint or UI.

**Break-it panel:** a dashboard control that forces the next adapter call
to simulate a 429, 500, or expired token, to demo retry/recovery live.

**Auth:** one hardcoded operator login. No signup flow, no multi-user
accounts.

**Secrets:** parsed from env with Zod at boot; the process exits loudly if
any required secret is missing.

## Testing Decisions

Test where behavior is worth protecting; do not test OAuth redirects,
framework wiring, or Drizzle itself — mocking Intuit to assert a redirect
proves nothing.

1. **Mapper** — pure unit tests: order in, invoice JSON out, covering tax,
   discounts, and an order for a customer that already exists in
   QuickBooks. No network, database, or clock in the test.
2. **Idempotency insert** — the same `(provider, event_id)` inserted twice
   produces one row in `events` and no error surfaced at the receiver.
3. **Backoff / retry classification** — the backoff calculation
   (`2^attempts` capped at 60 min), the `Retry-After` override, and the
   retryable-vs-non-retryable split (5xx/timeout/network/429 vs. other
   4xx vs. 401) all covered by unit tests against the calculation function,
   not a live QuickBooks call.
4. **Row-locking concurrency** — two concurrent actors contending for one
   Postgres row, tested for both cases this shape covers: (a) two workers
   never claim the same `sync_jobs` row, (b) two jobs for the same
   connection never both refresh the token at once.
5. **Reconciliation diff** — given a fake QuickBooks adapter returning a
   fixed set of invoices and a fixed set of Shopify orders (including a
   refunded one and a totals mismatch), asserts the correct `matched` /
   `refunded` / `drift` classification per order.
6. **Adapter DocNumber dedup** — calling the QuickBooks adapter twice with
   the same order asserts only one create request is made and the second
   call returns the existing `external_ref`, using a fake HTTP layer
   behind the adapter, not the real Intuit sandbox.

**End-to-end:** one Playwright test — connect both providers (seeded),
fire a webhook, see the invoice appear in Activity. No further E2E
coverage.

No prior art exists in this repo yet; this is the first spec against an
empty codebase.

## Out of Scope

- Syncing order **updates** — sync stays creation-only (open question in
  CONTEXT.md, not resolved by this spec).
- Bulk / batch replay of dead-lettered jobs.
- Automatically creating a QuickBooks credit memo for a refunded order —
  reconciliation only *flags* `refunded`; issuing the credit memo is a
  manual QuickBooks action.
- Any adapter beyond QuickBooks (Xero, etc.) — the adapter interface is
  designed to allow one later, but none is built now.
- Multi-tenancy, billing, user signup, dark mode, Redis, BullMQ,
  Kubernetes, or any abstraction added "for later" — excluded per
  CLAUDE.md.

## Further Notes

- Full domain vocabulary and the six-table schema are defined in
  `CONTEXT.md` — use those terms exactly (e.g. "job," not "task"; "event,"
  not "message").
- Decisions in this spec trace to `docs/adr/0001` through `0004`, produced
  in the grilling session that preceded this spec. Do not reopen them
  without a reason worth a new ADR.
- Setting up the Shopify Partners app and the Intuit sandbox is the
  operator's job, not the implementing agent's — generate a checklist/
  wizard for those steps rather than guessing credentials or dashboard
  values.
- The order-updates question (CONTEXT.md's one remaining open question) is
  intentionally left open; do not implicitly resolve it while implementing
  this spec.
