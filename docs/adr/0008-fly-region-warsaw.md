# ADR 0008 — Fly.io primary region: `waw` (Warsaw)

**Status:** Accepted
**Date:** 2026-10-05

## Context

`primary_region` is a decision, not a default
([`INIT-GENERIC-TEMPLATE.md` §1](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/scaffold/INIT-GENERIC-TEMPLATE.md));
a region is expensive to change once volumes exist
([`FLY-IO-DEPLOYMENT.md` §8](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/guides/FLY-IO-DEPLOYMENT.md)).
The product serves users and employers in Poland only.

## Decision

`primary_region = "waw"` for every app, including the Postgres volume. Latency to Polish users is
the point of the product's scope, and the guides' examples already use `waw`.

## Consequences

If a second region is ever wanted it is a new decision with a data-residency view (RODO) rather than
a toggle; the Postgres app is single-machine (`--ha=false`) and cannot be replicated by adding a
machine. **Reopen when** a non-Polish audience is in scope or `waw` capacity limits bite.
