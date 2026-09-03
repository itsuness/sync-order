# 02 — Env and secrets validated by Zod at boot

Status: ready-for-agent
Blocked by: 01

## Goal

Every required secret is parsed from `process.env` with a Zod schema when a
process starts. A missing or malformed value crashes the process loudly and
immediately, before any request or job is handled.

## Scope

- One Zod schema per process entry point (api, worker, web) in
  `packages/shared`, or one schema with per-process subsets — pick the
  simpler shape and document the choice in a comment.
- Covers at least: database URL, Shopify webhook HMAC secret, QuickBooks
  client id/secret, token-encryption key, operator login credentials,
  Shopify + QuickBooks API base URLs.
- Parsing happens once at boot; the parsed object is the only way the rest
  of the code reads config. No direct `process.env.X` outside this module.
- Failure prints which keys are missing/invalid and exits non-zero.
- `.env.example` listing every key with a placeholder and a one-line note.
  No real values.

## Out of scope

- Actually using the secrets (later tickets).
- Secret rotation, a secrets manager, encrypted `.env`.

## Acceptance criteria

- Booting any process with a complete `.env` succeeds.
- Removing one required key makes that process exit non-zero with a message
  naming the key. Verified by a script or a short manual note in the ticket.
- `grep -rn "process.env" apps packages` shows matches only inside the env
  module.

## Tests to write

- Unit: a valid env object parses; an object missing a required key throws
  with the key name in the error; a malformed value (e.g. non-URL database
  URL) throws. No real secrets in the fixture — use obviously-fake strings.

## Traces to

- US 30 (secrets validated by Zod at boot, loud exit).
- `CLAUDE.md` "Code standards": secrets from env only, parsed with Zod at
  boot, process exits loudly.
- Spec "Implementation Decisions": Secrets.
