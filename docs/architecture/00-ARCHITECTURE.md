# Architecture — work-in-poland measured against the constitution

This repository was initialised from the estate's greenfield template and is measured against
[`architecture-standards/docs/architecture/00-REFERENCE-ARCHITECTURE.md`](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/architecture/00-REFERENCE-ARCHITECTURE.md)
(P1–P15). **It references the constitution; it does not restate it.** Mode: greenfield
([`INIT-GENERIC-TEMPLATE.md`](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/scaffold/INIT-GENERIC-TEMPLATE.md)),
so there is no gap analysis between "what was built" and "what was meant" — this is the compliance
statement on the first delivery, with the evidence, the deviations and the open gaps.

**Contents**: [Shape](#shape) · [Compliance](#compliance) · [Deviation register](#deviation-register) ·
[Friction with authservice](#friction-with-authservice) · [Open gaps](#open-gaps) · [Non-goals](#non-goals)

## Shape

One service owning one database, one frontend, and one identity service consumed as a published image.

| Piece | What | Where |
|---|---|---|
| `WorkInPoland.AppHost` | P1 composition root, development only | `src/WorkInPoland.AppHost` |
| `WorkInPoland.ServiceDefaults` | P2 kernel (470 of 800 lines) | `src/WorkInPoland.ServiceDefaults` |
| `WorkInPoland.Contracts` | DTOs and constants across the HTTP boundary | `src/WorkInPoland.Contracts` |
| `WorkInPoland.Api` | the service: REST `/api/v1`, MCP `/mcp` + `/mcp/account`, `apidb` | `src/WorkInPoland.Api` |
| `web/app` | Next.js BFF and product surface | `web/app` |
| authservice | identity; **not** built here | `flyio/authservice.fly.toml` (image `v0.3.4`) |
| Postgres | one instance, `apidb` + `authdb`, a role each | `flyio/postgres.fly.toml` |

Diagram: [`docs/diagrams/a1-system-context.mmd`](../diagrams/a1-system-context.mmd) (also in the README).

## Compliance

| Principle | Status | Evidence / note |
|---|---|---|
| **P1** AppHost is the composition root, for development | ✅ | `src/WorkInPoland.AppHost/Program.cs`: Postgres, authservice container, API, web with `WithReference`/`WaitFor`/`WithHttpHealthCheck`. Fixed port for authservice (the issuer origin does not float). No publish-mode branch, no secret literal (`jwt-private-key` is a secret parameter from `dotnet user-secrets`). Builds; **not run end to end in this session's sandbox** (no Aspire runtime) — the compose stack, which the e2e job uses, was |
| **P2** kernel is plumbing, not domain; ceiling mechanical | ✅ | Exactly the eight concerns as extension methods; 470/800 lines. `scripts/check-kernel-size.sh` in CI and `KernelArchitectureTests` (size ≤ 800; references neither Api nor Contracts; declares no entity) |
| **P2a** every service calls `AddServiceDefaults()` | ✅ | `Program.cs`. authservice (an external image) is outside this repo's code |
| **P3** service per context, database per service | ✅ | One service, `apidb`. In production a `api` role with rights on `apidb` only and an `auth` role on `authdb` only (`flyio/postgres.fly.toml`). The MCP adapter lives in the same service on purpose — [ADR 0002](../adr/0002-mcp-is-an-adapter-inside-the-api.md) |
| **P4** provider-portable, migrated, never "ensured" | ⚠️ partial | `MigrateAsync` from a real `InitialCreate` migration in a hosted service **after** Kestrel starts (`MigrationBackgroundService`); no `EnsureCreated`, no `HasData`; demo data is a separate seeder (insert-if-missing). CI checks no pending model changes. **PostgreSQL only** — [deviation 1](#deviation-register). Migrations applied to a real Postgres 17 by `MigrationTests` (run with `WIP_TEST_POSTGRES`) |
| **P5** environment config, platform secrets, one signing key | ✅ | No secret in the tree (gitleaks hook + CI job). The API and web hold **no key material and mint no token**; RS256 only. `flyio/SECRETS.md` lists every secret and where it lands. `flyio/authservice.fly.toml` pins `Jwt__Algorithm=RS256` so a missing key fails the start; the deploy also asserts a non-empty JWKS |
| **P6** one container per service, multi-stage | ✅ | `src/WorkInPoland.Api/Dockerfile` (restore layer first, `aspnet:10.0` = TFM 10, `:8080`, non-root `$APP_UID`, source label); `web/app/Dockerfile` (`deps → builder → runner`, standalone, non-root `nextjs`). Both built in the session; the API image runs and answers `/health` |
| **P7** Fly.io, cost-shaped | ✅ | Four apps in `flyio/`, `dockerfile` **and** `context` declared, `min_machines_running` justified per app with the synchronous call named, Postgres with no public listener, `initial_size`, `PGDATA` subdirectory. Cost in `flyio/INFRASTRUCTURE-ANALYSIS.md` |
| **P8** optional dependencies degrade | ✅ | A fresh clone with no config runs (InMemory, anonymous reads, auth endpoints answer 401). `/health` returns the state of every integration (`telemetry`, `auth`, `cors`, `clientIpHeader`, `database`, `demoSeed`, `mcp`, `mcpAccount`) and the startup banner prints the same list — both from one `IntegrationState` list |
| **P9** `Program.cs` is a manifest | ✅ | `src/WorkInPoland.Api/Program.cs`: ~60 lines, each block one call; the three endpoint groups (`public`, `authApi`, `adminApi`) are visible in it |
| **P10** interface + registration | ✅ | Services behind interfaces, one DI line each; MCP tools are classes registered by the adapter. No base classes |
| **P11** anti-corruption at the edge | ✅ | MCP tool arguments are mapped onto the same request records as REST; no MCP type crosses into the services. Enumerations are strings at the boundary |
| **P12** tag-driven CI/CD | ✅ (written) / ⏳ (not run) | `.github/workflows/flyio.yml`: tag trigger, change detection against the previous tag, missing app ⇒ selected, build once to GHCR, `fail-fast: false`, ordered deploy with `success \|\| skipped` gates, database gated separately, JWKS non-empty assertion, public smoke. **Never executed** (needs `FLY_API_TOKEN`); `actionlint` is clean |
| **P13** test at the layer with the logic | ✅ | 304 xUnit tests (301 run + 3 Postgres-gated, run separately), 124 Vitest tests, Playwright e2e against the real stack in CI. See the [UI/UX doc](../ux/UI-UX.md) for what e2e covers |
| **P14** documentation in the repository | ✅ | README, API contract, 11 ADRs, this file, UI/UX backlog, the analysis. `scripts/check-links.mjs` is a CI gate |
| **P15** observability decided at build time | ⚠️ partial | OTLP traces, metrics and logs wired in the kernel when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; health probes filtered from traces. **Export to a real collector was not exercised**, and the web app emits no telemetry — [open gaps](#open-gaps) |

## Deviation register

Every row carries a date and a reason. An acknowledged deviation is a decision; an unacknowledged one is drift.

| # | Date | Deviation | Reason | Reopen when |
|---|---|---|---|---|
| 1 | 2026-10-05 | SQL Server provider not implemented; `DATABASE_PROVIDER=SqlServer` throws a pointer to this row. Only PostgreSQL migrations exist | Nothing here runs on SQL Server; an unapplied second migration set is untested code ([ADR 0011](../adr/0011-stack-deviations.md)) | a SQL Server deployment target exists |
| 2 | 2026-10-05 | pnpm workspace at the repository root rather than under `web/` | the e2e package lives in `tests/`; one workspace and one lockfile for all Node packages ([ADR 0011](../adr/0011-stack-deviations.md)) | never expected |
| 3 | 2026-10-05 | Dependabot declared for every ecosystem at `open-pull-requests-limit: 0` | no maintainer triages bumps on day one; vulnerability detection stays on (NuGetAudit on restore, `pnpm audit`, CodeQL) ([ADR 0006](../adr/0006-dependency-automation-declared-off.md)) | a maintainer triages weekly, or the repo goes public |
| 4 | 2026-10-05 | Second service **not** created for MCP; one extra rate-limit policy (`public`) beyond the standard `auth`/`api`/global set; no `auth` policy (identity is elsewhere) | MCP is an adapter over one aggregate ([ADR 0002](../adr/0002-mcp-is-an-adapter-inside-the-api.md)); anonymous reads need their own bucket | the MCP layer gains its own credential or availability risk |
| 5 | 2026-10-05 | Web is limited to one instance in production | refresh-token rotation is serialised **in process**; two instances can race the single-use refresh token and sign a user out | a shared lock (or sticky sessions) is added |
| 6 | 2026-10-05 | Single environment (`prod`), no staging, no PR preview environments | one repository owner, no users yet; the file layout supports a copy per environment ([`INFRASTRUCTURE-ANALYSIS.md`](../../flyio/INFRASTRUCTURE-ANALYSIS.md)) | the first paying customer |
| 8 | 2026-10-05 | CodeQL runs only when the repository is public or `CODEQL_ENABLED=true` | the repository is private and code scanning is not enabled for it, so every analysis failed at upload; the vulnerability half of the baseline is still covered by NuGetAudit on restore, `pnpm audit` and gitleaks | the repo goes public, or Advanced Security is enabled (set `CODEQL_ENABLED=true`) |
| 7 | 2026-10-05 | No Azure track | not requested; Fly.io is the product deployment | an Azure target is requested |

## Friction with authservice

Recorded here rather than patched around ([`MASTER-PROMPT.md`](https://github.com/konradcinkusz/architecture-standards/blob/main/docs/MASTER-PROMPT.md) ground rules); authservice's source is untouched.

1. **Pre-registered confidential clients only** (no dynamic registration, no public clients), so the OAuth MCP connector's credentials are operator-issued — [ADR 0003](../adr/0003-authservice-is-the-identity-provider.md), [`docs/MCP.md`](../MCP.md).
2. **Per-IP `auth` rate limit of 20 requests/minute, hard-coded**, keyed on the caller's address. Every sign-in, registration and token refresh from the web app arrives from the web app's one address, so the whole site shares one bucket. The BFF forwards the browser address in `X-Forwarded-For` (useful for audit records) but authservice trusts only its configured header. A candidate upstream change: a trusted-peer mode or configurable limits. **Not filed as an issue yet** — see the hand-off note in the final report.
3. **No account-deletion webhook.** Deleting the account at authservice leaves this service's tracker rows and companies; `DELETE /api/v1/me/data` exists and the web app calls it first, but a user who deletes the account some other way leaves orphans.
4. **No consent version for cookies as a separate document** in the required set, so `/cookies` shows the privacy version.

## Open gaps

Not closed in this session; each is tied to where it is tracked.

| Gap | Where |
|---|---|
| Backups: one Postgres machine, one volume, no tested restore | [`INFRASTRUCTURE-ANALYSIS.md`](../../flyio/INFRASTRUCTURE-ANALYSIS.md) |
| The deploy workflow and a live Fly deployment were **never run** (no `FLY_API_TOKEN`); "live on Fly.io" is therefore **not** claimed | README "Deploying"; first tag outcome is the next session's report |
| Live OAuth MCP flow (Claude → authservice → `/mcp/account`) not exercised end to end; token validation is covered with injected test keys and the compose stack covers the web scheme only | [`docs/MCP.md`](../MCP.md) |
| No admin UI; no account settings (2FA enrolment, change password) | [`UI-UX.md`](../ux/UI-UX.md) backlog |
| Web app emits no telemetry; no error tracking | P15 row above |
| Legal documents are drafts; RODO/KRAZ/salary-transparency questions unanswered | [`docs/analysis/NASTEPNE-KROKI.md`](../analysis/NASTEPNE-KROKI.md) |

## Non-goals

From the constitution's §4 and ADRs 0004, 0005, 0010: no second service, no event bus or service mesh,
no custom DI container, **no user store and no token minting**, no sample domain beyond the job board,
no CV storage, no payments, no scraping.
