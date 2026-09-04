# 04 — Webhook receiver: HMAC verify, store, 200 — nothing else

Status: done
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

## Comments

### Done — 2026-09-04

`POST /webhooks/shopify/orders-create` in `apps/api`:

- `apps/api/src/webhooks/shopify-hmac.ts` — pure, constant-time
  (`timingSafeEqual`) HMAC-SHA256 verify over the raw bytes.
- `apps/api/src/webhooks/orders-create-route.ts` — encapsulated Fastify
  plugin. Its own `application/json` parser keeps the body as a raw `Buffer`;
  `JSON.parse` runs only **after** the signature passes (US 1). `/health` on
  the root instance keeps the default parser.
- `apps/api/src/webhooks/record-shopify-event.ts` — inserts into `events`,
  returns a typed `RecordResult`; a unique-violation (SQLSTATE 23505, direct
  or on `.cause`) comes back as `reason: 'duplicate'`, never a throw.
- `packages/shared/src/db/client.ts` — `createDb(url)` (postgres-js pool +
  Drizzle, URL passed in) and a `migrateDb` helper. Ticket 03 shipped the
  schema and migration but no client; the receiver is the first caller.
- `buildApp({ db, shopifyWebhookSecret, logger? })`; `server.ts` wires it.

Status codes: valid + new → 200; valid + duplicate → 200 (no error logged);
bad/missing signature → 401 (no row); missing `X-Shopify-Event-Id` /
`X-Shopify-Topic`, or an unparseable body after a valid signature → 400;
any other insert failure → 500.

Verification (2026-09-04, `docker compose up -d`):

- `pnpm -r typecheck` clean.
- `TEST_DATABASE_URL=postgres://ordersync:ordersync@localhost:5433/ordersync_test pnpm test`
  → 27 passed. New coverage:
  - unit (`shopify-hmac.test.ts`): signed body passes; tampered body, wrong
    secret, malformed/empty signature all fail without throwing.
  - unit (`orders-create-route.test.ts`): static guard — no `quickbooks`
    reference in the receiver code path (AC 4 / CONTEXT "the one rule").
  - integration (`orders-create-route.integration.test.ts`, self-skips
    without `TEST_DATABASE_URL`): valid signature → 200 + exactly one row;
    same delivery twice → 200/200, one row, zero error-level log lines;
    tampered body → 401, zero rows; missing signature → 401, zero rows;
    signed with no event id → 400, zero rows.

Packages added: `zod` to `apps/api` (already on the approved stack; used for
the boundary error-shape check).

Deviations from a strict reading of Scope, for review:

- The ticket names 401 / 500 / 200. Added **400** for a syntactically bad
  request that clears HMAC — no `X-Shopify-Event-Id` / `X-Shopify-Topic`, or
  a body that is not JSON. A real Shopify delivery always carries both; this
  is boundary hardening (CLAUDE.md "Zod at every boundary"), not a new
  success path. Say if you'd rather these fall through to the insert and
  surface as 500.
- `buildApp` gained an optional `logger` param so the idempotency test can
  assert the receiver logs nothing on a duplicate. Defaults to `true`.
- `migrateDb` in `client.ts` is currently only exercised by the integration
  test; kept in `shared` (which owns the migrations) rather than reaching
  into `drizzle-orm/...migrator` from `apps/api`.
