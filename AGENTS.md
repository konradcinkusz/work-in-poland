# AGENTS.md

How an agent works in this repository. Short on purpose: the rules live in the estate's standards and
in `docs/`, and this file points at them rather than restating them.

## The one rule

The architecture is **already documented — read it, do not re-derive it.** Reconstructing rules from
whatever code happens to be in view is the single most expensive failure in this estate.

1. The constitution: `architecture-standards/docs/architecture/00-REFERENCE-ARCHITECTURE.md`
   (principles P1–P15 and the compliance checklist). `.claude/settings.json` declares the marketplace
   and enables `architecture-core`, so the standards are installed rather than remembered. If they are
   not available in your session, say so and stop; do not improvise them.
2. This repository measured against it: [`docs/architecture/00-ARCHITECTURE.md`](docs/architecture/00-ARCHITECTURE.md),
   including the **deviation register**. A deviation you keep is a decision with a date and a reason.
3. The guide for the domain you touch (`fly-io-deployment`, `identity-and-accounts`, `frontend-bff`,
   `service-api-patterns`, `testing-strategy`, `e2e-acceptance-testing`, `security-review`, …).

## Where things are

| You are changing | Read / edit |
|---|---|
| An endpoint, DTO, validation rule, MCP tool, auth scheme | [`docs/api/API.md`](docs/api/API.md) first — it is the contract between the API, the web BFF and MCP clients; change it in the same PR as the code |
| Why something is the way it is | [`docs/adr/`](docs/adr/) — one numbered record per decision, each with the trigger that would reopen it |
| The product's direction and its legal edges | [`docs/analysis/HIMALAYAS-DLA-POLSKI.md`](docs/analysis/HIMALAYAS-DLA-POLSKI.md) and [ADR 0010](docs/adr/0010-product-scope.md) |
| Screens, flows, the UI/UX backlog | [`docs/ux/UI-UX.md`](docs/ux/UI-UX.md) |
| Fly.io topology, secrets, cost | `flyio/` — `SECRETS.md`, `INFRASTRUCTURE-ANALYSIS.md`, one `*.fly.toml` per app |
| A script | [`scripts/README.md`](scripts/README.md) lists every script and variable by tier |

## Ground rules specific to this repository

- **Identity is not here.** No user store, no token minting, no signing key (P5). The API validates
  RS256 tokens against [authservice](https://github.com/konradcinkusz/authservice)'s JWKS; the web app
  calls authservice for sign-in. authservice is run from its published image and its source is never
  modified. Friction with it is recorded as an ADR or an issue on authservice, not patched around.
- **The kernel stays a kernel.** `src/WorkInPoland.ServiceDefaults` holds P2's eight plumbing concerns
  and nothing else — no entities, rules, seed data or user-facing strings. It is capped at 800 lines by
  `scripts/check-kernel-size.sh` and an architecture test.
- **No CV, no applicant content, ever** ([ADR 0004](docs/adr/0004-apply-by-redirect.md)). Applying is a
  redirect to the employer's own page. A feature that stores or forwards candidate documents is a new
  ADR and a legal review, not a ticket.
- **A listing needs a salary range to be published** ([ADR 0007](docs/adr/0007-mandatory-salary-ranges.md)).
  Contract type and gross/net basis are separate fields; benchmarks never mix bases.
- **No scraping.** Listings come from the employer who submits them, or from a partner acting for its
  own employers through the API. See ADR 0010.
- **Schema moves by migrations** (`scripts/add-migration.sh`), never `EnsureCreated` outside InMemory,
  never `HasData`.
- **Optional dependencies degrade, they do not fail startup** (P8). A fresh clone with no credentials
  must run, and `/health` must say what is degraded.
- **No secret is a literal anywhere.** A scanner runs as a pre-commit hook and a CI job. If it fires,
  rotate first.
- **Tests assert something.** `Assert.True(true)` and guarded-away Playwright steps are worse than no
  test, because they count (E2E-ACCEPTANCE-TESTING).

## Commands

```bash
./scripts/setup.sh                              # onboarding: prerequisites, deps, hooks, dev key
dotnet build WorkInPoland.sln                   # warnings are errors
dotnet test                                     # unit + architecture + (with WIP_TEST_POSTGRES) migration tests
pnpm lint && pnpm typecheck && pnpm test        # web
scripts/dev-stack.sh e2e                        # the Playwright suite against the real stack
dotnet run --project src/WorkInPoland.AppHost   # the development composition root (Aspire)
node scripts/check-links.mjs                    # every relative markdown link resolves
```

## Agents defined here

`.github/agents/` — read-only by construction (their `tools` allowlist has no edit tool):
`contract-reviewer` (a diff against the API contract and the standards) and `docs-keeper` (documentation
drift). Their descriptions carry worked invocation examples, because the description is the router.
