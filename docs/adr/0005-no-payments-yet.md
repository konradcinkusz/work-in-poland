# ADR 0005 — No payments in v1; promotion is granted by an operator

**Status:** Accepted
**Date:** 2026-10-05

## Context

The analysis prices a paid listing at roughly 890–1 990 PLN (order of magnitude only) and states
that the business question — would anyone pay — is answered by conversations, not code (§5).
Payments also bring VAT invoicing, a payment provider adapter (P11) and the guidance in
[`PAYMENTS-AND-MONETIZATION.md`](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/guides/PAYMENTS-AND-MONETIZATION.md)
— all before there is a customer.

## Decision

Publishing is free in v1 (capped per company, [API §7](../api/API.md#7-validation-rules)). The
promoted placement exists as data (`isPromoted` until a date) and as an admin action, so a
pre-sold promotion can be switched on by hand. No payment provider, no invoicing.

## Consequences

A one-sided free marketplace is a hypothesis, not a business, and the README says so. **Reopen
when** the pre-sale conversations in the analysis (§5) produce a willingness to pay; the seam is
`PromoteJob`, and the provider goes behind one interface with one adapter.
