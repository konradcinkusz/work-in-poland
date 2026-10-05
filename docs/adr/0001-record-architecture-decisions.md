# ADR 0001 — Record architecture decisions

**Status:** Accepted
**Date:** 2026-10-05

## Context

P14 of the [reference architecture](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/architecture/00-REFERENCE-ARCHITECTURE.md)
says documentation lives in the repository and records reasoning, not just steps. A deviation
that nobody wrote down is drift; one written down with a reason and a date is a decision.

## Decision

Decisions that a reader might otherwise think were inevitable are recorded as numbered ADRs in
this directory, from [`0000-template.md`](0000-template.md). Deviations from the standards also
get a dated row in the register in
[`../architecture/00-ARCHITECTURE.md`](../architecture/00-ARCHITECTURE.md#deviation-register),
linking the ADR that explains them.

## Consequences

Every ADR names the trigger that would reopen it, so "off for now" cannot become "off" by
forgetting. ADRs are never edited to change history: a reversed decision is a new ADR that
supersedes the old one.
