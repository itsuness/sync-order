# 07 — Adapter interface and in-memory fake

Status: ready-for-agent
Blocked by: 01

## Goal

Define the shared accounting-adapter interface the worker talks to, plus an
in-memory fake for tests. The worker must never know it is talking to
QuickBooks specifically.

## Scope

- In `packages/shared`: an `AccountingAdapter` interface with, at minimum:
  - `findInvoiceByDocNumber(docNumber): Promise<Result<Invoice | null, AdapterError>>`
  - `createInvoice(invoice): Promise<Result<Invoice, AdapterError>>`
  - `listInvoices(dateRange): Promise<Result<Invoice[], AdapterError>>` (for
    reconciliation, ticket 16)
  - `refreshToken(connection): Promise<Result<RefreshedTokens, AdapterError>>`
- Typed error shape carrying enough to classify a failure downstream:
  HTTP status (if any), a category (`network` | `timeout` | `http`), and
  `retryAfter` when present. No thrown strings — `Result`-style return
  values at this seam (`CLAUDE.md` code standards).
- Invoice / order JSON types shared here so the mapper (08) and adapters
  (12) agree.
- `FakeAccountingAdapter` implementing the interface with programmable
  responses (queue up a 429, a 500, a success, an existing invoice), used
  by tickets 11, 16, 22 tests.

## Out of scope

- The real QuickBooks HTTP adapter (ticket 12).
- Retry/backoff logic that consumes the error (ticket 10).
- The break-it fault injection wiring (ticket 22) — but design the fake so
  that ticket can drive it.

## Acceptance criteria

- `apps/api` worker code imports only the interface and types, never a
  QuickBooks symbol (grep check).
- The fake can be scripted to return each error category and a success, and
  records the calls made to it.

## Tests to write

- Unit: the fake returns queued responses in order and records calls. (This
  is test infrastructure; keep it minimal.)

## Traces to

- `CONTEXT.md` "Adapter"; Spec "Implementation Decisions": Adapter
  interface (adding Xero later = new adapter, not a worker edit).
- `CLAUDE.md`: every external call goes through an adapter implementing the
  shared interface; errors are typed return values at module seams.
