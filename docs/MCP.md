# Using work-in-poland from an AI assistant (MCP)

The API speaks the [Model Context Protocol](https://modelcontextprotocol.io) over Streamable HTTP
on two routes ([ADR 0002](adr/0002-mcp-is-an-adapter-inside-the-api.md); tool list and scopes in
[`api/API.md` §9](api/API.md#9-mcp)).

| Route | Sign-in | What you get |
|---|---|---|
| `https://<api host>/mcp` | **none** | Read-only: `search_jobs`, `get_job_details`, `search_companies`, `get_company`, `get_salary_benchmarks`, `list_filter_values` |
| `https://<api host>/mcp/account` | OAuth 2.1 (code + PKCE) through authservice | All of the above **plus** your tracker and, for employers, company and listing management |

`<api host>` is `work-in-poland-api-prod.fly.dev` for the Fly deployment and `localhost:<port>` under
the AppHost. The web app's **/mcp** page ("Asystenci AI") shows the same snippets with the addresses
filled in from runtime configuration.

## For a user

### Anonymous, any client

Claude Code:

```bash
claude mcp add --transport http work-in-poland https://work-in-poland-api-prod.fly.dev/mcp
```

Cursor, `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "work-in-poland": { "url": "https://work-in-poland-api-prod.fly.dev/mcp" }
  }
}
```

Then ask in plain language — Polish works:

- "Znajdź zdalne oferty dla senior backend developera z B2B powyżej 25 000 zł netto."
- "Jakie są widełki dla mid fullstack w Krakowie na UoP? Ile ofert za tym stoi?"
- "Pokaż szczegóły pierwszej oferty i podaj link do aplikowania."

Salary benchmarks compare like with like: UoP is gross, everything else net, normalised to a month.
With fewer than three offers behind a number the tool says so instead of reporting it.

### With your account (tracker, employer tools)

`/mcp/account` is an OAuth-protected connector. In **Claude** (web, desktop, mobile): *Settings →
Connectors → Add custom connector*, URL `https://work-in-poland-api-prod.fly.dev/mcp/account`, then
**Advanced settings** and enter the OAuth **client id and client secret**. Claude opens authservice's
sign-in page (branded "Work in Poland"), you sign in with your account and approve the scopes:

| Scope | Lets the assistant |
|---|---|
| `jobs:read` | read your tracked jobs |
| `tracker:write` | save a job, change its status, add notes, remove it |
| `employer:write` | create companies and create, edit, publish, close and renew listings you own |

**The client id and secret are issued by the operator.** This is a known limit of the identity
service, not an oversight here: authservice supports pre-registered *confidential* clients only — no
dynamic client registration and no public clients — and Claude's connector requires the secret
([ADR 0003](adr/0003-authservice-is-the-identity-provider.md), friction 1). A shared secret is not
something to publish; until authservice grows public clients, a user who wants the connector asks the
operator, and everyone else uses the anonymous `/mcp` endpoint, which needs nothing.

What the assistant cannot do, by design: send a CV (none is stored,
[ADR 0004](adr/0004-apply-by-redirect.md)), apply for you (it gives you the employer's own link), or
touch anyone else's listings (a foreign id is a `404`).

## For the operator

### Registering the Claude connector client

The client is configured in `flyio/authservice.fly.toml` (id `claude-work-in-poland`, redirect
`https://claude.ai/api/mcp/auth_callback`, scopes `jobs:read tracker:write employer:write offline_access`,
resource `https://work-in-poland-api-prod.fly.dev/mcp/account`). Its **secret** is the GitHub
environment secret `MCP_CLIENT_SECRET` and the **encryption key** is `AUTH_ENCRYPTION_KEY`
([`flyio/SECRETS.md`](../flyio/SECRETS.md)). Generate them, never invent them:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

(First line: client secret, hex. Second: encryption key, base64.) Hand the **client id and secret** to
the person adding the connector. authservice's configuration is authoritative: at every start the
client is created or brought up to date, and a client removed from configuration is deleted together
with every authorization and token it held.

### What must be true for it to work

- authservice signs with **RS256** (`Jwt__Algorithm=RS256`, a private key) and has
  `Jwt__PublicBaseUrl` set to its public https origin — that string is the `iss` of MCP tokens and the
  API's `Mcp__AuthorizationServer` must equal it exactly.
- The API's `Mcp__ResourceUri` equals the client's `AllowedResources` entry **exactly**: lowercase
  scheme and host, no trailing slash. Every MCP token is bound to that one `aud`.
- authservice stays at `min_machines_running = 1`: Claude waits at most 10 seconds for its discovery
  and token endpoints ([`flyio/INFRASTRUCTURE-ANALYSIS.md`](../flyio/INFRASTRUCTURE-ANALYSIS.md)).
- The API serves its own protected-resource metadata (RFC 9728) and lists authservice **first and
  only** in `authorization_servers` — Claude uses the first entry and does not fall back.

### Verifying from a terminal

```bash
curl -i -X POST https://work-in-poland-api-prod.fly.dev/mcp/account -H 'Content-Type: application/json' -d '{}'
```

Expect `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp/account"`.

```bash
curl https://work-in-poland-api-prod.fly.dev/.well-known/oauth-protected-resource/mcp/account
```

```bash
curl https://work-in-poland-authservice-prod.fly.dev/.well-known/oauth-authorization-server
```

`scripts/smoke-public.sh` runs the whole chain, including an anonymous `initialize` + `tools/list`
that fails if an account tool is visible without a token.

### Two tokens, two audiences

| Token | `aud` | Accepted by |
|---|---|---|
| web session (BFF cookie) | `WorkInPoland` | `/api/v1/**` only |
| MCP access token | the `/mcp/account` URI | `/mcp/account` only |

An MCP token presented to `/api/v1` is refused, and a web token presented to `/mcp/account` is
refused — tests in `tests/WorkInPoland.Api.Tests/Mcp/` and `…/Infrastructure/` hold both directions.
