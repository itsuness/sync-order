# Idempotent QuickBooks writes via deterministic DocNumber

The events table stops a duplicate *event* from producing two jobs, but a job
can still call QuickBooks twice — the worker can crash or time out after
QuickBooks creates the invoice but before `sync_jobs.external_ref` is saved,
and the next attempt re-sends the same job. We derive a deterministic
`DocNumber` from the Shopify order id (`SHOP-{order_id}`) and have the
adapter query QuickBooks for an existing invoice with that `DocNumber`
before creating one — if found, the attempt is treated as a success and
just saves `external_ref`; no second invoice is created.

## Considered options

- Trust `attempts`/`status` alone and never re-check QuickBooks — rejected,
  this is exactly the race that causes duplicates.
- An idempotency key checked only in our own database before the call —
  doesn't help if the crash happens between the QuickBooks response and the
  local write. `DocNumber` is checked *against QuickBooks itself*, so it's
  correct even if our own state was lost.
