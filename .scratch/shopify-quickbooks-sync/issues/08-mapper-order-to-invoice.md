# 08 — Mapper: Shopify order → QuickBooks invoice JSON (pure)

Status: ready-for-agent
Blocked by: 03, 07

## Goal

A pure function: Shopify order in, QuickBooks invoice JSON out. No network,
no database, no `Date.now()`. Reads per-connection rules from
`field_mappings` passed in as an argument. This is the piece safe to change
per client.

## Scope

- `mapOrderToInvoice(order, fieldMappings, clock)` — all inputs passed in;
  the clock is an argument, never read ambiently.
- Correctly carries:
  - line items with quantities and unit prices;
  - tax (as QuickBooks expects it on an invoice);
  - discounts (order-level and/or line-level per the Shopify payload);
  - a customer that already exists in QuickBooks — the mapper emits a
    reference the adapter can resolve, and does not force creation of a
    duplicate customer record;
  - the deterministic `DocNumber` = `SHOP-{order_id}` (so the adapter and
    the mapper agree on it).
- `field_mappings` rules drive field selection/renaming; unknown or missing
  rules fall back to a documented default.
- Amounts handled in integer minor units where money is compared later
  (ties to reconciliation, ticket 16).
- Returns a typed `Result` — a malformed order is a typed error, not a
  throw.

## Out of scope

- Sending the invoice (ticket 11/12).
- Fetching `field_mappings` from the database (the caller does that).
- Resolving the existing customer against the live QuickBooks API (adapter,
  ticket 12) — the mapper only emits the reference.

## Acceptance criteria

- Given a fixed order + fixed `field_mappings` + fixed clock, output is
  deterministic and matches a checked-in expected JSON fixture.
- No `import` of anything doing I/O; no `Date` construction without the
  injected clock (grep / lint check).

## Tests to write (Testing Decision 1)

Pure unit tests, no network/database/clock:
- order with tax → invoice reflects the tax lines/amount;
- order with a discount → invoice reflects the discount;
- order for a customer that already exists in QuickBooks → invoice
  references the existing customer, no duplicate-create signal;
- `DocNumber` == `SHOP-{order_id}`.

## Traces to

- US 10 (pure mapper), US 11 (tax, discounts, existing customer), US 12
  (`field_mappings` as data).
- `CONTEXT.md` "Mapper"; `CLAUDE.md` "The mapper is pure"; Testing
  Decision 1.
