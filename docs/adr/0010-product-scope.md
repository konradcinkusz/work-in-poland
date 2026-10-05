# ADR 0010 — Product scope: build the platform; the go-to-market gates stay business decisions

**Status:** Accepted
**Date:** 2026-10-05

## Context

The [analysis](../analysis/HIMALAYAS-DLA-POLSKI.md) concludes that a 1:1 Himalayas copy for Poland is
a bad bet (option A), that a narrow niche board (B) is acceptable only after pre-sales, that an
MCP/AI layer sold to existing boards (C) is the most interesting but needs customers first, and that
a portfolio MCP server from legal sources (D) is the cheap start. Its first-things-first list is
sales conversations, not code (§5).

The request for this repository was nonetheless a complete implementation. Reading the analysis
honestly, the four options share one technical core: a job model with the salary dimensions of §4,
search, an MCP server with OAuth, and apply-by-redirect. They differ in **who the customer is and
where the data comes from** — and those are exactly the things code cannot decide.

## Decision

Build the shared core as a working, deployable platform, with the constraints that keep every
option open and none of the analysis' legal warnings violated:

- **Data from consenting sources only.** Listings are submitted by the employer themselves
  (or, for option C, through the same API by a partner portal acting for its employers). No
  scraping, ever — the analysis rules it out for A, and §5.3 requires each source's terms and
  consent first.
- **No CV handling** ([ADR 0004](0004-apply-by-redirect.md)); no payments
  ([ADR 0005](0005-no-payments-yet.md)); mandatory ranges
  ([ADR 0007](0007-mandatory-salary-ranges.md)).
- **MCP is the front door**, anonymous for reading and OAuth for accounts
  ([ADR 0002](0002-mcp-is-an-adapter-inside-the-api.md)), because that is the portfolio
  asset in options C and D.
- The deliverable is **a platform, not a market**. The README states plainly that shipping it does
  not answer the questions of §5; the five portal conversations and the twenty employer messages
  are still the next step, and the choice between B, C and D is still open.

## Consequences

If pre-sales say *portals want an MCP layer* (C), the work is making the API's job intake
multi-tenant for a partner (a per-partner scope in authservice and a bulk intake endpoint). If they
say *niche employers will pay* (B), it is adding category pages and payments. If neither, it is
option D: the same code serving the portfolio. **Reopen when** the pre-sales outcome is known.
