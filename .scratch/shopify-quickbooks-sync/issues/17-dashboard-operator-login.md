# 17 — Dashboard: one hardcoded operator login

Status: ready-for-agent
Blocked by: 01

## Goal

The Next.js dashboard is protected by a single hardcoded operator login. No
signup, no multi-user accounts, no password reset.

## Scope

- Login page: username + password checked against the operator credentials
  from the env schema (ticket 02). Compare with a constant-time check;
  store only a hash of the configured password if that's simple, otherwise
  compare the configured value directly and note the tradeoff.
- On success, set an HTTP-only session cookie (signed). A logout action
  clears it.
- Middleware / layout guard: every dashboard route except the login page
  redirects to login when unauthenticated.
- The `apps/api` endpoints that back dashboard actions (replay in
  ticket 14, break-it in ticket 22, reconcile trigger) require the same
  session.

## Out of scope

- OAuth for the operator. Provider OAuth (Shopify/QuickBooks connect) is
  separate and seeded for tests.
- Roles, permissions, more than one user.
- Rate-limiting / lockout (single-tenant portfolio scope).

## Acceptance criteria

- Wrong credentials → rejected, no session.
- Correct credentials → session cookie set, dashboard reachable.
- Hitting any dashboard route without a session → redirect to login.
- Logout → session cleared, dashboard no longer reachable.

## Tests to write

- Per `CLAUDE.md` we do not test framework wiring / OAuth redirects. Keep
  to one unit test on the credential-check function (correct vs wrong), and
  cover the guarded-route behaviour in the Playwright test (ticket 23)
  rather than here.

## Traces to

- US 28 (single hardcoded login, no user accounts).
- Spec "Implementation Decisions": Auth. `CLAUDE.md` "Not in scope": no
  user signup, one hardcoded operator login.
