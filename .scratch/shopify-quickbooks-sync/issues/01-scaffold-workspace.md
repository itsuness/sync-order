# 01 — Scaffold the pnpm workspace

Status: ready-for-agent
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
