# 04 — Webhook receiver: HMAC verify, store, 200 — nothing else

Status: ready-for-agent
Blocked by: 02, 03

## Goal

The Shopify `orders/create` endpoint verifies the HMAC signature, stores the
raw event, and returns 200. It never calls QuickBooks. A duplicate delivery
returns 200 and leaves exactly one row.

## Scope

- `POST` route in `apps/api` for the Shopify webhook.
- HMAC verification against the raw request body using the secret from
  ticket 02. Constant-time compare. A bad or missing signature → 401, no
  row written.
- On valid signature: insert into `events` (provider `shopify`, event_id
  from `X-Shopify-Event-Id`, topic, raw payload as received). The variable
  holding the raw payload is named `event`.
- Rely on the `UNIQUE(provider, event_id)` constraint for idempotency:
  catch the unique-violation, return 200, do not surface an error.
- Any other insert failure → 500 (Shopify will redeliver).
- Response is 200 with an empty or minimal body as soon as the row is
  committed. No job creation here (ticket 05 hooks in), no external calls.

## Out of scope

- Creating the `sync_jobs` row (ticket 05).
- Backfill's use of the same table (ticket 15).
- Authenticating any non-Shopify caller.

## Acceptance criteria

- Valid signature + new event → 200, one `events` row.
- Valid signature + already-seen `event_id` → 200, still one row, no error
  logged as failure.
- Invalid signature → 401, zero rows.
- The handler body contains no reference to any QuickBooks adapter or
  client (enforces the CONTEXT "one rule").

## Tests to write

- Idempotency insert: calling the receiver twice with the same
  `(provider, event_id)` produces one row in `events` and no error surfaced
  at the receiver (Testing Decision 2). Integration test against test
  Postgres.
- HMAC: a request with a tampered body fails verification; a correctly
  signed request passes. Fixed test secret, not a real one.

## Traces to

- US 1 (HMAC before anything), US 2 (verify-store-200 only), US 3
  (duplicate → one row, no error).
- `CONTEXT.md` "The one rule" and "The path of one order" steps 1–2.
- Testing Decision 2.
