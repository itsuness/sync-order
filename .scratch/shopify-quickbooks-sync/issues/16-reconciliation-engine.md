# 16 — Reconciliation engine: live QuickBooks vs Shopify totals

Status: ready-for-agent
Blocked by: 07, 12

## Goal

For a date range, compare Shopify order grand totals against invoices
fetched *live from QuickBooks* (not against `sync_jobs`), joining by
`external_ref`. Classify each order `matched`, `refunded`, or `drift`.

## Scope

- `reconcile(dateRange, deps)`:
  - fetches QuickBooks invoices in the range via `adapter.listInvoices`
    (ticket 07/12);
  - fetches Shopify orders in the range (paged client, same as backfill's
    reader) including refund state;
  - joins QuickBooks invoice ↔ order via `sync_jobs.external_ref`;
  - per order, computes grand total (line items + tax + shipping −
    discounts) in integer minor units on both sides;
  - classification:
    - `matched` — exact-cent equality on the grand total, integer minor
      units, no tolerance;
    - `refunded` — the Shopify order has a refund (regardless of total
      match) → expected, needs a credit memo, not drift;
    - `drift` — joined but totals differ and no refund; or an order with no
      corresponding QuickBooks invoice; or an invoice with no order.
  - returns a typed report: per-order status + both totals + the reason.
- Pure comparison core (totals + classification) separated from the two
  fetchers so it can be unit-tested with fixtures.

## Out of scope

- The screen / date picker (ticket 20).
- Creating the credit memo for a `refunded` order (explicitly out of scope
  — reconciliation only flags).
- Persisting reconciliation results (on-demand only per spec).

## Acceptance criteria

- Given fixed QuickBooks invoices and fixed Shopify orders (including one
  refunded order and one 1-cent mismatch), each order is classified
  correctly.
- A 1-cent difference is `drift`, never rounded to `matched`.
- A refunded order with mismatched totals is `refunded`, not `drift`.
- Comparison is done in integer minor units — no float equality anywhere in
  the core.

## Tests to write (Testing Decision 5)

- Reconciliation diff: fake adapter returns a fixed invoice set, a fixed
  Shopify order set with a refunded order and a totals mismatch → assert
  `matched` / `refunded` / `drift` per order.
- Unit: the minor-units grand-total calculation for tax + shipping +
  discount combinations.

## Traces to

- US 24 (compare live QuickBooks data for a date range), US 25 (exact-cent
  equality, no tolerance), US 26 (refund → `refunded`, not `drift`).
- ADR-0004; `CONTEXT.md` "Reconciliation"; Testing Decision 5.
