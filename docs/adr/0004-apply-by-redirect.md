# ADR 0004 — Applying is a redirect to the employer's own page; no CV is stored

**Status:** Accepted
**Date:** 2026-10-05

## Context

The [analysis](../analysis/HIMALAYAS-DLA-POLSKI.md) §4 separates *publishing job ads* from
*collecting CVs and passing them to employers*. The second may require an entry in the register of
employment agencies (KRAZ) and makes the operator a controller of candidates' personal data under
RODO. Neither has been checked with a lawyer, and neither is needed to validate the idea.

## Decision

A listing carries an `https` `applyUrl` that points at the employer's own ATS or careers page. The
product never stores, receives or forwards a CV or any application content. "Apply" is a redirect
through `POST /jobs/{slug}/apply-click`, which only increments a counter. The candidate's
**tracker** holds the candidate's own status and notes — data they enter about themselves —
and nothing in it is visible to anyone else, including employers.

## Alternatives considered

- **Hosted application form + CV upload.** Rejected: KRAZ and RODO exposure, plus storage and
  deletion obligations (IDENTITY-AND-ACCOUNTS §8, "cascade does not reach blob storage").
- **`mailto:` apply.** Rejected: puts candidates' CVs in arbitrary mailboxes via our UI and gives
  nothing to count.

## Consequences

No candidate profile, no "send my CV to companies", no employer-side applicant inbox. Himalayas'
talent search is deliberately not copied. **Reopen when** a lawyer has confirmed the KRAZ position
and there is demand that the redirect cannot meet.
