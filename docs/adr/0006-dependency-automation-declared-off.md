# ADR 0006 — Dependency automation is declared and switched off

**Status:** Accepted
**Date:** 2026-10-05

A deliberate deviation from [`REPO-BASELINE.md` §1](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/guides/REPO-BASELINE.md),
which lists dependency-update automation as a baseline item
([`INIT-GENERIC-TEMPLATE.md` §4](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/scaffold/INIT-GENERIC-TEMPLATE.md)).

## Context

A repository on its first day has no one to own a bump. Automation that opens pull requests
nobody triages produces the thing baselines exist to prevent: a queue that is ignored until it is
closed wholesale, after which the repo has *worse* dependency hygiene than one with no
automation, because everyone believes it is covered.

## Decision

`.github/dependabot.yml` declares every ecosystem the repository has — nuget, npm,
github-actions and both docker contexts — each with a schedule and
`open-pull-requests-limit: 0`, Dependabot's own switch for "declared, opening no version-update
pull requests".

What is **not** deferred: vulnerability detection. `NuGetAuditMode=all` with
`NuGetAuditLevel=low` in `Directory.Build.props` fails the restore on a vulnerable package,
transitive ones included; `pnpm audit` runs in CI; CodeQL runs on every pull request. What is
deferred is version *freshness*.

Dependabot **security updates and vulnerability alerts are repository settings, not this file**,
so "off" here does not turn them off. At the time of writing the repository settings were left at
GitHub's defaults for a new repository (alerts on; security updates are the owner's choice in
Settings → Code security) — check them rather than assuming.

## Trigger for turning it on

The repository has a maintainer who triages dependency updates weekly, **or** it goes public.
Turning it on is one line per ecosystem (raise the limit) against a file that has already been
reviewed.
