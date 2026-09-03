# 19 — Connections view: flag `disconnected`, offer reconnect

Status: ready-for-agent
Blocked by: 09, 17

## Goal

The dashboard shows each connection's status and, when a connection is
`disconnected`, flags it visibly with a way to reconnect — so the operator
knows immediately that QuickBooks access lapsed and how to fix it.

## Scope

- A connections panel listing each `connections` row: provider, external
  account id (realmId for QuickBooks), `status`, `expires_at`.
- A `disconnected` connection is visually distinct (not just a text label
  in a table of greens) and shows a "Reconnect" action that starts the
  provider OAuth flow.
- The OAuth callback lands the new tokens and sets `status = connected`
  again; jobs for that connection become claimable again (ticket 06 already
  gates on status).
- While `disconnected`, optionally show the count of jobs waiting on this
  connection so the operator sees the impact.

## Out of scope

- Testing the OAuth redirect itself (`CLAUDE.md`: don't).
- Automatic reconnect / re-auth without operator action.
- Editing tokens by hand in the UI.

## Acceptance criteria

- A `connected` connection shows as healthy.
- Setting a connection to `disconnected` (e.g. via the token-refresh
  failure path or a seed) makes the dashboard show the flagged state and a
  Reconnect action.
- Completing reconnect flips it back to `connected` and its jobs resume
  being claimed.

## Tests to write

- Covered by the Playwright path in ticket 23 for the healthy case (connect
  both providers, seeded). No dedicated OAuth test here.

## Traces to

- US 9 (disconnected connection visibly flagged with a way to reconnect).
- ADR-0003 (a failed refresh disconnects until the operator reconnects via
  OAuth); `CONTEXT.md` "Connection".
