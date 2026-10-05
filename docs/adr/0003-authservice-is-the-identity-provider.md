# ADR 0003 — authservice is the only identity provider

**Status:** Accepted
**Date:** 2026-10-05

## Context

The system has users: candidates track applications, employers publish listings. P5 says exactly
one service holds a signing key and every other service validates against its JWKS; the
estate's identity service is [`konradcinkusz/authservice`](https://github.com/konradcinkusz/authservice).

## Decision

- authservice is run **from its published image** as its own Fly app
  (`work-in-poland-authservice-<env>`), configured and deployed from this repository's
  `flyio/`. Its source is never vendored or modified.
- This repository has **no user store and mints no token**. `WorkInPoland.Api` validates RS256
  tokens through authservice's JWKS; the web app's server side calls authservice for register,
  login, refresh, consent, verification and reset, and keeps the tokens in `httpOnly` cookies.
- `Jwt__Issuer` and `Jwt__Audience` are both `WorkInPoland`, so a token from another product on
  the same image cannot authenticate here.
- **MCP sign-in** uses authservice's OAuth 2.1 authorization server in its default **Hosted**
  interaction mode: authservice renders sign-in and consent itself (named `App__Name`), and links
  to our `FrontendBaseUrl` for registration and password reset. Registered scopes: `jobs:read`,
  `tracker:write`, `employer:write` and the mandatory `offline_access`. Resource =
  `https://<api host>/mcp/account`.
- Roles `Admin` and `SuperAdmin` (authservice's own) gate the admin endpoints.

## Alternatives considered

- **External interaction mode** (our frontend renders sign-in and consent). Rejected for v1: it
  doubles the surface we must secure (the interaction handle is a bearer secret for ten minutes)
  for a consent page that Hosted mode already renders.
- **Identity inside the API.** Rejected outright by P5.

## Consequences

Friction recorded rather than patched around (MASTER-PROMPT ground rule):

1. authservice supports **pre-registered confidential clients only**; there is no dynamic client
   registration and Claude's custom connector needs a client id and secret under "Advanced
   settings". A public product therefore cannot hand every user a connector credential without
   either publishing a shared secret or provisioning clients per user. v1 answer: the anonymous
   `/mcp` endpoint needs nothing; the OAuth connector's credentials are issued by the operator.
   **Reopen when** authservice gains public clients / dynamic registration, or a user-facing
   self-service credential screen is justified by demand. Tracked in the UI/UX backlog.
2. authservice's Hosted pages say "register at `FrontendBaseUrl`", so `FrontendBaseUrl` must be
   the public web origin.
3. `min_machines_running = 1` for the authservice app: every validator fetches its JWKS in-request
   ([`FLY-IO-DEPLOYMENT.md` §7](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/guides/FLY-IO-DEPLOYMENT.md)).
