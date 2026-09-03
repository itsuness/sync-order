# 12 — QuickBooks adapter: DocNumber dedup + full audit logging

Status: ready-for-agent
Blocked by: 03, 07, 11

## Goal

The real QuickBooks Online adapter implementing the shared interface
(ticket 07). Derives `DocNumber = SHOP-{order_id}`, checks QuickBooks for an
existing invoice with that `DocNumber` before creating one, and returns
enough per call for the worker to write a complete `audit_log` row.

## Scope

- `QuickBooksAdapter` implementing `AccountingAdapter`:
  - `findInvoiceByDocNumber` → QuickBooks query API for that `DocNumber`;
    returns the existing invoice (with `external_ref`) or null.
  - `createInvoice` → POST; only called by the worker when find returned
    null.
  - `listInvoices(dateRange)` → for reconciliation (ticket 16).
  - `refreshToken` → Intuit token endpoint; returns new tokens + expiry.
- A fake HTTP layer behind the adapter (injected `fetch`-like) so tests
  never touch the Intuit sandbox.
- Each method returns, alongside its result, the request payload, response
  payload, status code, and duration so the worker's step 5 can write
  `audit_log` (direction, provider `quickbooks`, endpoint, request,
  response, status_code, duration_ms).
- Errors mapped to the typed `AdapterError` shape (status, category,
  `retryAfter` from the `Retry-After` header on 429).
- No secret read ambiently — tokens and realmId come from the connection
  passed in.

## Out of scope

- The OAuth authorization-code flow / redirect handling (not tested per
  spec; the connect step is seeded for E2E in ticket 23).
- Retry decisions (ticket 10) — the adapter surfaces the error, the worker
  classifies it.
- Any non-QuickBooks adapter.

## Acceptance criteria

- Calling the adapter twice with the same order: `findInvoiceByDocNumber`
  finds the invoice created by the first call, so only one create request
  is made and the second call returns the existing `external_ref`.
- A 429 response surfaces `retryAfter` from the header.
- Every call returns the fields the worker needs for a complete
  `audit_log` row.

## Tests to write (Testing Decision 6)

- Adapter DocNumber dedup: two calls with the same order → exactly one
  create request, second returns the existing `external_ref`. Fake HTTP
  layer, not the Intuit sandbox.
- Error mapping: a 500 / 429 / 404 from the fake HTTP layer maps to the
  right `AdapterError` (category + status + `retryAfter` on 429).

## Traces to

- US 13 (deterministic `DocNumber`, query-before-create), US 14 (audit
  every call).
- ADR-0001; `CONTEXT.md` "The path of one order" step 7; Testing
  Decision 6.
