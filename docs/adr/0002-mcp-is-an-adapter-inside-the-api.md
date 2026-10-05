# ADR 0002 — MCP is an adapter inside the API, not a second service

**Status:** Accepted
**Date:** 2026-10-05

## Context

The product is MCP-first: an AI assistant searches jobs, an employer posts one through
conversation. The template this repository was initialised from deliberately ships **one**
service ([`INIT-GENERIC-TEMPLATE.md` §12](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/scaffold/INIT-GENERIC-TEMPLATE.md):
"a second service is a design decision with a reason, not a scaffolding default", P3).

An MCP server is a transport: it maps tool calls onto operations the REST API already offers.
Putting it in its own service would give it either its own copy of the job aggregate (two writers
to one cohesion — what P3 forbids) or a network hop to the API that needs a token it cannot hold,
because authservice issues MCP tokens with the MCP server as their audience and the REST API
refuses them ([authservice ADR 0005](https://github.com/konradcinkusz/authservice/blob/main/docs/decisions/0005-mcp-authorization-server.md)).
Bounded contexts are drawn around data cohesion, not around transports (P3).

## Decision

The MCP server is a set of tool classes inside `WorkInPoland.Api`, mapped on two routes that
differ only in authentication and tool set:

- `/mcp` — anonymous, read-only tools. Works from any MCP client with zero setup, which matters
  because authservice has no dynamic client registration.
- `/mcp/account` — OAuth 2.1 through authservice (authorization code + PKCE), the public tools
  plus the tracker and employer tools, scope-checked inside each tool.

The tools call the same application services as the REST endpoints; the MCP layer is
anti-corruption (P11): tool arguments are mapped onto the same request records, and no MCP type
crosses into the domain. A second authentication scheme (`Mcp`, different audience) lives next to
the web scheme (`Bearer`), so a token for one is refused by the other.

## Alternatives considered

- **A separate `mcp` service** (Fly app, own image). Rejected: the token-audience problem above,
  plus a second scale-to-zero cold start on the request path (P7), for no gain in isolation —
  the MCP layer has no credential or availability risk of its own that would justify P3 beating
  P10.
- **One endpoint with the tool list varying by token.** Rejected: an anonymous client would never
  see the account tools, so Claude would never be prompted to sign in. Two routes make the
  behaviour explicit.

## Consequences

One image, one database, one deployment. The cost is that an MCP bug is an API bug in the same
process; the mitigation is that the adapter is thin and tested through a real MCP client.

**Reopen when** the MCP layer needs a dependency with its own credential or availability risk
(say, a model call or a third-party data source) — then P3 wins over P10 and it becomes a service.
