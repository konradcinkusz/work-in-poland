# Secrets: what is secret, where it lives, how to set it

P5: configuration through the environment, secrets through the platform. `[env]` in a `fly.toml` is
public (it appears in `fly config show` and in image metadata); anything you would not paste into a
pull request is a secret. **No secret is ever a literal in this repository** — a scanner enforces
it in the pre-commit hook and in CI.

## The one-time human setup (per repository)

1. `fly tokens create org` → store the result as **`FLY_API_TOKEN`** in a GitHub **environment**
   named `production` (an environment can be reviewed and restricted; a repository secret cannot).
2. Add the root secrets below to that same environment. Generate them — never make them up
   (a human asked to invent a secret writes `changeme`, and `changeme` reaches production).
3. After the **first** `v*` tag has pushed the two application images, make the GHCR packages
   `work-in-poland-api` and `work-in-poland-web` **public** (GitHub → Packages → Package settings).
   Fly pulls them without a credential ([ADR 0009](../docs/adr/0009-registry-ghcr.md)). They contain
   no secret. The deploy job checks this and fails with the instruction if it was skipped.

Nothing else: no `fly launch`, no app creation, no volume creation. The first tag provisions the
estate from cold (`.github/workflows/flyio.yml` creates every missing app and the volume).

## The root secrets (GitHub environment `production`)

| Secret | Required | Where it ends up | How to generate |
|---|---|---|---|
| `FLY_API_TOKEN` | **yes** | the Fly CLI in every deploy job | `fly tokens create org` |
| `PG_ADMIN_PASSWORD` | **yes** | `POSTGRES_PASSWORD` on `work-in-poland-postgres` | `openssl rand -hex 24` |
| `APIDB_PASSWORD` | **yes** | the `api` role's password, and `ConnectionStrings__apidb` on the API app | `openssl rand -hex 24` |
| `AUTHDB_PASSWORD` | **yes** | the `auth` role's password, and `ConnectionStrings__DefaultConnection` on authservice | `openssl rand -hex 24` |
| `JWT_PRIVATE_KEY_PEM` | **yes** | `Jwt__PrivateKeyPem` on authservice — the system's **only** signing key | `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048` (PKCS#8, "BEGIN PRIVATE KEY") |
| `AUTH_ENCRYPTION_KEY` | **yes** (an MCP client is configured) | `AuthorizationServer__EncryptionKey` | `openssl rand -base64 32` |
| `MCP_CLIENT_SECRET` | **yes** (an MCP client is configured) | `AuthorizationServer__Clients__0__ClientSecret` | `openssl rand -hex 32` |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | optional | seeds one `SuperAdmin` on first start; without it there is no admin and the admin endpoints are unreachable | a real address, a long random password |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | optional | email delivery. Without it authservice only **logs** emails: verification and reset links are never delivered (P8: degrades, does not fail) | SendGrid console |

Generated passwords are **hex**, not base64: `+`, `/`, `=` and `;` all mean something inside a
connection string, and the bug surfaces one rotation later in a component nobody was touching.

On Windows, `openssl` is not a command. Use the repository's own generator, which emits the same
formats from Node (already a prerequisite):

```bash
node scripts/generate-dev-key.mjs
```

For the random values: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.

## Where each secret is applied

The workflow derives everything else; connection strings are **assembled from a password plus a
known host**, never stored per service, and are set with `--stage` so one release does not restart
an app twice.

| Fly app | Secrets set by the workflow |
|---|---|
| `work-in-poland-postgres` | `POSTGRES_PASSWORD`, `APIDB_PASSWORD`, `AUTHDB_PASSWORD` (read by the first-boot init script, which creates the `api` and `auth` roles and their databases) |
| `work-in-poland-authservice-prod` | `ConnectionStrings__DefaultConnection`, `Jwt__PrivateKeyPem`, `AuthorizationServer__EncryptionKey`, `AuthorizationServer__Clients__0__ClientSecret`; optionally `InitialAdmin__*`, `SendGrid__*` |
| `work-in-poland-api-prod` | `ConnectionStrings__apidb` — and **nothing else**: this service holds no key material (P5) |
| `work-in-poland-web-prod` | none. Its configuration is public addresses in `flyio/web.fly.toml` |

**The deploy fails on a missing critical secret** (the *Require the critical secrets* steps). A signing
key is not an optional dependency: without it authservice infers the symmetric algorithm, publishes a
valid but **empty** JWKS, and every consumer rejects every token while everything reports healthy.
The deploy also asserts the JWKS publishes at least one key.

## Rotation

- **Signing key**: rolling, never a flag day. Generate a new key, move the *old public key* to
  `Jwt__PreviousPublicKeyPem` on authservice, set the new private key, deploy. Both verify, only the new
  one signs. Drop the previous key after one access-token lifetime — and after a **refresh-token
  lifetime** (30 days) when an MCP client is configured, because the authorization server signs its
  refresh tokens with the same key.
- **Database passwords**: `ALTER ROLE api PASSWORD '…'` through `fly ssh console -a work-in-poland-postgres`,
  update the GitHub secret, re-run the deploy for the owning app.
- **A secret that reached history**: rotate first, clean history second. The commit is public the moment
  it is pushed; scrubbing without rotating is theatre.

## Local development

Nothing above is needed locally. `scripts/setup.sh` (or `setup.ps1`) generates a throwaway development
signing key into the Aspire parameter store (`dotnet user-secrets`), and `.env` is gitignored with
`secrets.env.example` as the committed contract. **A local key is never a production key.**
