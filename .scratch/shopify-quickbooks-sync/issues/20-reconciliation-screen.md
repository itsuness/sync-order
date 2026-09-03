# 20 — Reconciliation screen

Status: ready-for-agent
Blocked by: 16, 17

## Goal

A dashboard screen that runs the reconciliation engine (ticket 16) for an
operator-chosen date range and shows each order as `matched`, `refunded`,
or `drift`.

## Scope

- Date-range picker; a "Run reconciliation" button that calls the engine
  on demand (guarded by ticket 17). This hits the live QuickBooks API, so
  show a loading state and handle a slow/failed run gracefully.
- Results table grouped or filterable by status:
  - `drift` surfaced most prominently (this is the actionable one);
  - `refunded` shown as expected-and-explained, with a note that it needs a
    manual credit memo in QuickBooks;
  - `matched` collapsible / summarised.
- Each row shows both grand totals (Shopify vs QuickBooks, in currency),
  the order reference, and the `external_ref`.
- A summary line: counts per status for the range.

## Out of scope

- Creating credit memos (out of scope — flag only).
- Persisting or scheduling reconciliation runs (on-demand only).
- Exact-cent / classification logic — that lives in ticket 16; this screen
  only renders its report.

## Acceptance criteria

- Running a range with a known refunded order and a known 1-cent mismatch
  shows one `refunded` and one `drift`, not two `drift`.
- A failed QuickBooks fetch shows an error state, not a blank/`matched`
  screen.
- Counts in the summary line match the row counts.

## Tests to write

- Classification correctness is ticket 16's test. Here, at most a component
  test that the report renders the three statuses distinctly. Prefer to
  lean on ticket 23's Playwright coverage rather than add heavy UI tests.

## Traces to

- US 24 (reconciliation screen comparing Shopify totals against live
  QuickBooks invoices for a date range).
- ADR-0004; `CONTEXT.md` "Reconciliation" ("the screen that proves the
  engine works").
