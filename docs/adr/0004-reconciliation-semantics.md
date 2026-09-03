# Reconciliation compares live QuickBooks data, not our own sync_jobs table

Reconciliation is the screen that proves the engine works — if it only read
`sync_jobs`, it would prove our own bookkeeping is self-consistent, not
that QuickBooks agrees with Shopify. An invoice edited or deleted directly
in QuickBooks after a successful sync would still read as "matched" against
`sync_jobs` alone. Reconciliation instead queries QuickBooks for invoices
in the date range and joins them to `sync_jobs` by `external_ref`.

A match is exact-cent equality (compared in integer minor units, not
floats) on the grand total including tax, shipping, and discounts — no
rounding tolerance; a one-cent difference is drift worth surfacing, not
noise.

Sync stays creation-only, so an order refunded after its invoice was
created will never have that reflected in QuickBooks and would otherwise
show as permanent, unexplained drift. Reconciliation reads the Shopify
order's refund state at comparison time and reports a third status,
`refunded` (expected, needs a credit memo in QuickBooks), distinct from
`drift` (unexpected, needs investigation) — without syncing updates, which
stays out of scope.

## Considered options

- Compare against `sync_jobs` only — much cheaper (no extra QuickBooks API
  calls), rejected because it can't catch drift introduced outside our own
  writes.
- Lump refunds into `drift` — rejected, it trains the operator to ignore
  the drift list within the first few refunds, defeating the point of the
  screen.
