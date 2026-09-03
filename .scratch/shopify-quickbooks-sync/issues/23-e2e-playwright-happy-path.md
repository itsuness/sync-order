# 23 — End-to-end Playwright test: webhook to invoice in Activity

Status: ready-for-agent
Blocked by: 12, 18

## Goal

The one and only end-to-end test: with both providers connected (seeded),
fire a Shopify webhook and see the resulting invoice appear in the Activity
view. No further E2E coverage.

## Scope

- Test setup:
  - a test Postgres with migrations applied;
  - seeded `connections` rows for Shopify and QuickBooks, both
    `connected`, with non-expired tokens;
  - seeded `field_mappings` for the QuickBooks connection;
  - the QuickBooks adapter pointed at a fake/stub HTTP layer that accepts
    the create and returns an invoice id (no Intuit sandbox);
  - the worker loop running (or pumped once by the test).
- Test body:
  1. operator logs into the dashboard (ticket 17);
  2. POST a valid HMAC-signed `orders/create` webhook to `apps/api`;
  3. receiver returns 200 and one `events` row + one `pending` job exist;
  4. the worker processes the job;
  5. the Activity view (ticket 18) shows that order as invoice-created with
     an `external_ref` and a visible `audit_log` call.
- Runs via `pnpm e2e`. Deterministic — no reliance on wall-clock sleeps
  beyond a bounded poll for the job to finish.

## Out of scope

- OAuth connect flows (seeded, not driven).
- Failure/retry paths, reconciliation, break-it, backfill — not covered
  E2E per the spec ("one Playwright test only").
- Testing against real Shopify or real QuickBooks.

## Acceptance criteria

- `pnpm e2e` passes from a clean checkout with a test database available.
- The test fails if the receiver calls QuickBooks directly (the one rule),
  if the job never reaches `done`, or if Activity doesn't show the invoice.

## Tests to write

- This ticket *is* the test. One spec file.

## Traces to

- Spec "Testing Decisions": End-to-end — one Playwright test, connect both
  providers (seeded), fire a webhook, see the invoice appear in Activity.
- `CLAUDE.md` "Testing": one Playwright test only.
