# Infrastructure analysis: topology, sizing, cost

P7: cost is reasoned about explicitly, per service, in the repository
([`FLY-IO-DEPLOYMENT.md` §13](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/guides/FLY-IO-DEPLOYMENT.md)).
Four questions, each answered with a decision someone can take. Prices are **indicative list prices
recalled from Fly's public pricing page and not re-checked here** — verify them at
<https://fly.io/docs/about/pricing/> before budgeting; the structure of the argument is the
deliverable, not the cents.

## 1. What runs when nothing is happening?

| App | Shape | Machines when idle | Size | Why it is not zero |
|---|---|---|---|---|
| `work-in-poland-postgres` | database | **1** (never stops) | shared-cpu-1x, 1 GB + 5 GB volume | state; a volume cannot scale to zero or out |
| `work-in-poland-authservice-prod` | HTTP | **1** | shared-cpu-1x, 512 MB | on every validator's request path (below) |
| `work-in-poland-api-prod` | HTTP | **1** | shared-cpu-1x, 512 MB | the frontend calls it in-request (below) |
| `work-in-poland-web-prod` | frontend | **0** | shared-cpu-1x, 512 MB | entered only from a browser |

Order of magnitude, one region (`waw`), always-on machines for a full month: Postgres ≈ 1 GB machine
+ volume, authservice and API ≈ the 512 MB tier each, web ≈ pennies (only while serving). **Roughly
USD 12–15 a month in total** at list prices. A figure to be re-derived from the pricing page, not
quoted.

## 2. Which services pin a machine, and which synchronous call forces it?

The rule is mechanical (FLY §7): *for every in-request call A→B, either B keeps a machine running, or
A's timeout comfortably exceeds B's cold start.* Applied to the actual calls:

| Call (A → B) | Forces | Decision |
|---|---|---|
| Browser → web | nothing: a cold start is a slow first page, not a failed call | web `min_machines_running = 0` |
| web server side → **api** (every SSR page, every BFF proxy call, `/sitemap.xml`) | api must be up, or web's timeout must exceed the .NET cold start (several seconds) | **api pins 1.** Pinned rather than "timeout out-waits boot", because the second option is written down far more often than it is configured |
| web middleware and api → **authservice** (JWKS fetch, on first use **and on every cache expiry**) | authservice is on the synchronous path of every validator, not only the first request | **authservice pins 1** |
| Claude → authservice (discovery 10 s, token endpoint 10 s, refresh 30 s) | authservice must answer well inside 10 s | already pinned |
| Claude / any MCP client → api `/mcp`, `/mcp/account` | api must answer the first `initialize` quickly | already pinned |
| api / authservice → postgres (`.internal:5432`) | `.internal` does **not** start a stopped machine | postgres never stops and has no `auto_stop` |

## 3. What is the cheaper option, and what does it actually cost?

- **Let the API scale to zero** (`min_machines_running = 0`). Saves ≈ the price of one 512 MB machine
  per month (a few dollars). Costs a several-second stall on the first page after idle, and the
  first MCP `initialize` after idle may exceed an MCP client's timeout. Taken only when traffic is
  so low that the first-visitor stall is the common case — which is also the case in which the
  saving is the only thing that matters. **Not taken now**; reopen on the first month with a bill
  that is noticed.
- **Let authservice scale to zero.** Not a real option: Claude's 10-second ceiling on the discovery
  and token endpoints makes every connector sign-in after idle a coin flip, and every JWKS cache
  expiry elsewhere turns into a failed request.
- **Run Postgres on a smaller machine** (512 MB). Saves ≈ the difference between the 1 GB and 512 MB
  tiers. Costs headroom for two databases and migrations at startup; Postgres under memory
  pressure fails in ways that look like application bugs. Not taken.
- **A managed Postgres** instead of a self-run app: removes operating a database (backups, upgrades,
  failover) at several times the price. The honest gap here is **backups** — the database is a single
  machine on a single volume. See §4 and the backlog.

## 4. What is off the table?

So nobody re-proposes them:

- **Turning off `force_https`.** Every app terminates TLS at the Fly proxy; tokens and cookies travel
  over it.
- **One database shared between services.** One *instance* is a cost decision; one *database and one
  role per service* is the boundary (P3). The `api` role has no rights on `authdb` and vice versa.
- **A public IP or `[http_service]` on Postgres.** A database with a public listener is a database
  waiting to be scanned; reach it with `fly proxy 15432:5432 -a work-in-poland-postgres`.
- **Scaling Postgres past one machine by adding machines** (`--ha=false`, volume = one disk). A second
  machine gets a second *empty* volume.
- **Service-to-service HTTP over `.internal`.** The default is the public URL: the proxy starts a
  stopped machine, `.internal` does not. (The issuer URL is forced public regardless: it is stamped
  into `iss` and every validator fetches JWKS from it.)
- **A second region.** Single region `waw` ([ADR 0008](../docs/adr/0008-fly-region-warsaw.md)); a second
  region is a data-residency decision (RODO), not a toggle.

## Known gaps (not yet a decision someone can take)

| Gap | Consequence | Trigger |
|---|---|---|
| **No backups.** One machine, one volume | losing the volume loses every account and listing | before the first real user: schedule `pg_dump` to object storage, or take Fly volume snapshots (they are on by default for 5 days — verify in the dashboard) and test a restore |
| **authservice's per-IP `auth` limiter is 20 requests/minute and the web app is one IP** | one bucket for every sign-in on the site; a burst of 20 logins/refreshes in a minute throttles everyone | when concurrent sign-ins plausibly approach that, decide between a trusted-peer header in authservice (an upstream change; [ADR 0003](../docs/adr/0003-authservice-is-the-identity-provider.md)) and forwarding the client IP in a header authservice is told to trust |
| **No staging environment.** One `prod` set of apps | a deploy is a production change | the first paying customer; the file layout supports a copy per environment (`-staging` apps, one toml each) |
