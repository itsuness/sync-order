# 18 — Activity view: the path of each order

Status: ready-for-agent
Blocked by: 03, 17

## Goal

A dashboard screen that shows, per order, the path it took: event received
→ job claimed → invoice created or failed. The operator answers "what
happened to this order?" without touching the database.

## Scope

- A list of recent orders/events, newest first, each row showing: order
  reference (`SHOP-{order_id}` / Shopify order name), provider, received_at,
  current job status (`pending` / `running` / `done` / `failed`), attempts,
  `external_ref` (linked/labelled) when `done`, `last_error` when `failed`.
- A detail view for one order assembling its timeline from existing tables:
  - `events.received_at` (event received);
  - `sync_jobs.claimed_at` + status transitions (job claimed / running);
  - `audit_log` entries for that job (each QuickBooks call, status code,
    duration);
  - terminal state: invoice created (`external_ref`) or failed +
    `dead_letter` reference.
- Read-only. Pagination or a sane row cap.
- Data comes from `apps/api` read endpoints (guarded by ticket 17), or
  Next.js server components hitting the database directly — pick one and be
  consistent.

## Out of scope

- Replaying from this screen (that's the dead-letter screen, ticket 21).
- Editing anything.
- Real-time push/websockets — a refresh is fine.

## Acceptance criteria

- An order that synced cleanly shows: received → claimed → invoice created,
  with the `audit_log` call visible and an `external_ref`.
- A failed order shows the failure point and `last_error`, and links to its
  `dead_letter` entry if dead-lettered.
- No write actions on the screen.

## Tests to write

- The end-to-end assertion (invoice appears in Activity after a webhook) is
  the Playwright test in ticket 23. Here, at most a unit test on the
  timeline-assembly function that turns rows from the four tables into an
  ordered timeline.

## Traces to

- US 29 (Activity view showing each order's path).
- `CONTEXT.md` "The path of one order"; `audit_log` purpose.
