# 21 — Dead-letter screen with one-at-a-time replay

Status: ready-for-agent
Blocked by: 14, 17

## Goal

A dashboard screen listing dead-lettered jobs with their final error and
payload, and a per-row button to replay exactly one job. No bulk replay.

## Scope

- List from `listDeadLetters()` (ticket 13), newest first: order reference,
  final error, `created_at`, `replayed_at` (blank if not yet replayed).
- A row detail showing the stored payload and the full final error.
- A "Replay" button per row calling the ticket 14 endpoint for that one
  `dead_letter` id. After replay: the row shows `replayed_at`, and the
  button is disabled / gone for that row.
- No "select all", no multi-select, no "replay all" control anywhere on
  the screen.
- Guarded by ticket 17.

## Out of scope

- The state transition itself (ticket 14).
- Deleting dead-letter rows (never — they're kept).
- Editing the payload before replay.

## Acceptance criteria

- The screen lists every `dead_letter` row with error + payload reachable.
- Clicking Replay on one row sends only that job back to `pending` and
  stamps `replayed_at`; other rows are untouched.
- There is no control that replays more than one job at once.
- A replayed job that later succeeds shows as `done` in Activity
  (ticket 18); one that re-dead-letters appears as a new/updated
  dead-letter entry.

## Tests to write

- Backend behaviour is ticket 14's test. Here, lean on ticket 23's
  Playwright coverage if replay is included there; otherwise one component
  test that only a single id is posted per click.

## Traces to

- US 20 (kept with final error and payload), US 21 (manually replay one
  dead-lettered job at a time from the dashboard).
- Spec "Implementation Decisions": Dead-letter replay — no bulk replay
  endpoint or UI.
