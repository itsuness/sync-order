# 01 — Scaffold the pnpm workspace

Status: done
Blocked by: none

## Goal

Stand up the empty monorepo so every later ticket has a place to put code
and a way to run tests. No feature logic.

## Scope

- pnpm workspace with `apps/api`, `apps/web`, `packages/shared`.
- Node 24, TypeScript `strict: true` everywhere. Shared `tsconfig.base.json`
  extended by each package.
- `apps/api`: Fastify app skeleton with one `/health` route returning 200.
- `apps/web`: Next.js 15 App Router, Tailwind, shadcn/ui at defaults. One
  placeholder page.
- `packages/shared`: empty entry point, wired as a workspace dependency of
  both apps.
- Vitest configured at the root, running per-package. `pnpm test` works and
  passes with zero tests.
- Playwright installed and configured in `apps/web` (or root), `pnpm e2e`
  wired but with no spec yet.
- Lint/format config consistent with the repo (no new rules invented).
- `.gitignore` covering `node_modules`, `.env`, `.next`, build output.

## Out of scope

- Database, Drizzle, migrations (ticket 03).
- Env parsing (ticket 02).
- Any route or page beyond the health check and one placeholder.
- Docker, CI config.

## Acceptance criteria

- `pnpm install` at the root resolves all three packages.
- `pnpm -r typecheck` passes.
- `pnpm test` passes (no tests yet is fine).
- `pnpm --filter api dev` serves `/health` → 200.
- `pnpm --filter web dev` serves the placeholder page.

## Tests to write

None. This is scaffolding; per CLAUDE.md we do not test framework wiring.

## Traces to

- Stack section of `CLAUDE.md` (fixed stack, no substitutions).
- Spec "Further Notes": first spec against an empty codebase.

## Comments

`apps/api` and `packages/shared` were scaffolded in earlier commits. This
pass added the remaining pieces: `apps/web` (Next.js 15.5.25 App Router,
pinned — `create-next-app@latest` currently bootstraps Next 16, which
CLAUDE.md's stack pin rules out), Tailwind v4 + shadcn/ui via
`shadcn init -d --no-monorepo` (its own default preset, `base-nova`), one
placeholder page, and `@order-sync/shared` wired as a dependency. Also
added root `playwright.config.ts` (`testDir: './e2e'`) and `vitest.config.ts`
(excludes `e2e/`) — `pnpm e2e` was actually broken before this: Playwright
had no config and was scanning `packages/shared`'s Vitest test file, which
crashed. Root `vitest.config.ts` is a single flat config rather than
per-package, by choice — one file already covers every package's tests and
a projects split has no real need yet.

Verification (2026-09-03):

- `pnpm install` at the root resolves all four workspace projects.
- `pnpm -r typecheck` passes (`packages/shared`, `apps/api`, `apps/web`).
- `pnpm test` passes (9 tests, from ticket 02).
- `pnpm e2e` (`playwright test --pass-with-no-tests`) exits clean, no crash.
- `pnpm --filter web dev` → `curl localhost:3000` returns the placeholder
  page (title "Order Sync", `<div>Hello world!</div>`, Tailwind CSS loaded).
- `pnpm --filter api dev` → `curl localhost:3001/health` → 200 (re-verified
  here since it's also this ticket's acceptance criterion).
- Reviewed via `/code-review` against ticket 01 and `CLAUDE.md`: no hard
  standards violations. Two judgment calls raised and accepted: the unused
  `components/ui/button.tsx` from `shadcn init`'s own default output is kept
  (later dashboard tickets will need shadcn components), and the flat
  Vitest config is kept over a per-package split.
