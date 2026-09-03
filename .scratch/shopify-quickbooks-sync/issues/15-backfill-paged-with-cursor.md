# 15 — Backfill: page the provider API, resume from a saved cursor

Status: ready-for-agent
Blocked by: 03, 04

## Goal

Import historic Shopify orders by paging the provider API and writing the
same `events` table the webhook path writes. A crash at page 40 resumes at
page 40 from a saved cursor — not a restart.

## Scope

- A backfill command/entry point that:
  - pages the Shopify orders API (cursor-based pagination);
  - for each order, writes an `events` row (provider `shopify`, the
    provider's event/order identifier as `event_id`, topic, raw payload) —
    the same insert path as ticket 04, so the `UNIQUE(provider, event_id)`
    guard dedupes an order already received by webhook;
  - persists the pagination cursor after each successfully-written page;
  - on start, resumes from the saved cursor if one exists.
- Job creation (ticket 05) fires for each new event exactly as on the
  webhook path.
- Re-running a completed backfill is a no-op (all events already present).
- Where the cursor is stored: pick the simplest correct place that does not
  require a seventh table (e.g. a row in an existing table, or a documented
  single-row config mechanism) and note the choice.

## Out of scope

- A UI to trigger the backfill (command / script is enough for this spec).
- Syncing order updates (out of scope).
- Rate-limit tuning beyond respecting Shopify's `Retry-After`.

## Acceptance criteria

- Running the backfill writes one `events` row per historic order and one
  `pending` job per new event.
- Killing the process mid-run and restarting resumes from the saved cursor;
  no page is re-fetched from the beginning, no event is written twice.
- An order already present from the webhook path does not create a second
  event or job.

## Tests to write (Testing Decision 5 area: cursor resume)

- Integration with a fake paginated Shopify client: run pages 1–3, simulate
  a crash before page 4's cursor is saved, restart → resumes at page 4 (or
  re-runs page 4 only), final `events` count equals total orders with no
  duplicates.
- Integration: an event id already in `events` is skipped silently.

## Traces to

- US 22 (backfill writes the same events table), US 23 (crash at page 40
  resumes at page 40).
- `CONTEXT.md` "Backfill", "Cursor".
