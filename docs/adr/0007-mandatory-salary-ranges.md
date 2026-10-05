# ADR 0007 — A salary range is mandatory to publish, and contract type is its own dimension

**Status:** Accepted
**Date:** 2026-10-05

## Context

Since 24 December 2025 the Labour Code requires pay information to be given before an interview or
hiring — a starting amount or a range, with all components — but **not** necessarily in the ad
itself ([analysis §2](../analysis/HIMALAYAS-DLA-POLSKI.md)). How it applies to B2B and what the
penalties are was not established and is for a lawyer. Pay transparency is no longer a
differentiator; No Fluff Jobs already requires ranges. In Polish IT the same job is routinely paid
under UoP (gross) and B2B (net of VAT), and the two are not comparable.

## Decision

1. A listing **cannot be published** without 1–4 salary offers, one per contract type
   (`uop`, `b2b`, `zlecenie`, `dzielo`), each with `min`, `max`, currency, period and an explicit
   gross/net basis. This is a **product rule** of the platform, stricter than the statute and
   not a statement of what the statute requires.
2. Contract type and gross/net basis are separate fields on the offer — never one combined value —
   so filters, benchmarks and the MCP tools can treat them as the two dimensions the analysis (§4)
   calls for.
3. Salary benchmarks compare only offers whose basis is implied by the contract type (UoP gross,
   others net) and refuse to report statistics under three offers.

## Consequences

Fewer, higher-quality listings and a salary benchmark that is a by-product of the data rather than
a feature that needs its own source. If the statute turns out to demand something more specific
(components, per-contract fields), the offer shape is the place it is added.
