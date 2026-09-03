## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.

Rules for working in this repo. `CONTEXT.md` holds the domain language and
the design decisions. Read it first. This file is about how we work.

---

## Stack — fixed, do not substitute

- Node 22, TypeScript, `strict: true`
- pnpm workspace: `apps/api`, `apps/web`, `packages/shared`
- API: Fastify
- Web: Next.js 15 App Router, Tailwind, shadcn/ui at its defaults
- Database: PostgreSQL on Supabase, accessed with Drizzle ORM
- Queue: a Postgres table claimed with `SELECT ... FOR UPDATE SKIP LOCKED`
- Tests: Vitest for units, Playwright for one end-to-end path
- Validation: Zod at every boundary — env, webhook payloads, API responses

Ask before installing any package not on this list. Name the package, say
what it replaces, and wait.

## Not in scope — do not add

No Redis. No BullMQ. No Kubernetes. No multi-tenancy. No billing. No user
signup — one hardcoded operator login. No dark mode toggle. No custom
design system. No abstraction added "for later".

If you think one of these is needed, say why and wait. Do not add it and
tell me afterwards.

## Code standards

- No `any`. No non-null assertion `!`. No `as` casts to silence the compiler.
- Errors are typed return values at module seams, not thrown strings.
- Every external call goes through an adapter that implements the shared
  interface. The worker must not know it is talking to QuickBooks.
- The mapper is pure: no network, no database, no `Date.now()`. Pass the
  clock in.
- Secrets come from env only, parsed with Zod at boot, and the process
  exits loudly if any are missing. Never a secret in the repo, never in a
  test fixture.
- File names and variable names use the vocabulary in `CONTEXT.md`.
  A variable holding a raw payload is `event`, not `message` or `data`.

## Testing

Test where behaviour is worth protecting:

- The mapper: order in, invoice out, including tax, discount, and a
  customer that already exists.
- The idempotency insert: the same `(provider, event_id)` twice produces
  one row and no error at the receiver.
- The backoff calculation, including the 429 `Retry-After` override.
- The claim query: two concurrent workers never claim the same job.
- The reconciliation diff.

Do not write tests for OAuth redirects, framework wiring, or Drizzle
itself. Mocking Intuit to assert a redirect proves nothing. If TDD would
mean building a mock of a third-party API, stop and ask me first.

One Playwright test only: connect both providers (seeded), fire a webhook,
see the invoice appear in Activity.

## Git

- Small commits, one working step each. Plain messages in the imperative:
  "add events table with unique constraint".
- Never one giant "initial commit". The history is part of the portfolio.
- Do not commit `.env`, tokens, or sandbox credentials.
- Do not push to main with a failing build or failing tests.

## How to work with me

- Show the plan and the file tree before writing more than two files.
- Do one step, then stop. Tell me the exact command to verify it works.
  Wait for me to confirm before the next step.
- When my instruction is unclear, wrong, or conflicts with `CONTEXT.md`,
  say so and stop. Do not guess and do not silently pick an interpretation.
- When you hit an error, do not patch around it. Find the cause. Read
  `CONTEXT.md` before assuming the design is wrong.
- Do not write summaries of what you just did unless I ask. I can read the
  diff.
- Keep comments rare. Explain why, never what.

## When you are stuck on a third-party dashboard

Setting up Shopify Partners, the custom app, or the Intuit sandbox is my
job, not yours. Generate a wizard or a checklist for me to follow. Do not
try to guess the values.
