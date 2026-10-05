# ADR 0011 — Stack deviations from the template: PostgreSQL only, root pnpm workspace

**Status:** Accepted
**Date:** 2026-10-05

## Context

Two places where this repository departs from the letter of the template; both are recorded in the
deviation register.

## Decisions

1. **PostgreSQL and InMemory only; `DATABASE_PROVIDER=SqlServer` fails with an explanatory
   message.** P4 describes a provider-portable persistence layer with provider-specific migration
   sets. Fly runs this system on Postgres (ADR 0008), nothing here runs on SQL Server, and a second
   migration set that no environment ever applies is untested code. The kernel's
   `AddDatabaseContext` keeps the switch shape so adding the provider is a package, a migrations
   set and a CI job, not a redesign. **Reopen when** a deployment target on SQL Server exists.
2. **The pnpm workspace is at the repository root** (`web/app`, `tests/e2e`), not under `web/`.
   The template's tree puts it at `web/`, but the e2e package lives in `tests/` and one workspace
   with one lockfile for every Node package is what FRONTEND-BFF §7 asks for. The web image builds
   with the repository root as its context for the same reason.

## Consequences

Deviation register rows 1 and 2. Dependabot's npm entry points at `/`.
