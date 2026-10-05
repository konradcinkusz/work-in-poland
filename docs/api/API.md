# HTTP API and MCP contract (v1)

This is the contract between the three things that talk to each other in this repository:
the API (`src/WorkInPoland.Api`), the web BFF (`web/app`) and AI assistants (MCP). Code that
disagrees with this document is the bug, unless the document is changed in the same pull
request.

Identity is **not** in this document: sign-in, registration, refresh, consent and the OAuth
authorization server for MCP clients belong to
[authservice](https://github.com/konradcinkusz/authservice), the system's only identity
provider ([ADR 0003](../adr/0003-authservice-is-the-identity-provider.md)). This API only
*validates* the tokens it issues.

**Contents**

1. [Conventions](#1-conventions)
2. [Vocabulary](#2-vocabulary)
3. [Public endpoints](#3-public-endpoints)
4. [Candidate endpoints (tracker)](#4-candidate-endpoints-tracker)
5. [Employer endpoints](#5-employer-endpoints)
6. [Admin endpoints](#6-admin-endpoints)
7. [Validation rules](#7-validation-rules)
8. [Authentication and authorization](#8-authentication-and-authorization)
9. [MCP](#9-mcp)
10. [Configuration keys](#10-configuration-keys)
11. [What the web BFF consumes from authservice](#11-what-the-web-bff-consumes-from-authservice)

---

## 1. Conventions

- Base path `/api/v1`. JSON, `camelCase`. Enumerations are lowercase strings (§2). Ids are
  GUIDs. Timestamps are ISO-8601 UTC. Money is a JSON number with at most 2 decimals.
- **Errors** are `application/problem+json` (RFC 9457):
  `{ "type", "title", "status", "detail", "errors": { "<field>": ["<message>"] } }`.
  Validation failures are `400` with `errors` (the shape `Results.ValidationProblem` emits).
  `401` has no body. `403` and `404` and `409` carry `title` + `detail`.
- **Rate limiting** answers `429` with `{ "error": "rate_limited", "retryAfter": <seconds> }` and
  a `Retry-After` header. The shape is the same for every endpoint.
- **Lists are clamped**: `page` ≥ 1 (default 1), `limit` 1–100 (default 20). Out-of-range
  values are clamped, not rejected. A page is `{ "items": [...], "total": n, "page": n, "limit": n }`.
- Public reads are anonymous. Every other group requires a bearer token (§8).
- **No CV, no applicant data is stored or transported** ([ADR 0004](../adr/0004-apply-by-redirect.md)).
  Applying means opening the employer's own `applyUrl`.

## 2. Vocabulary

| Field | Values |
|---|---|
| `category` | `backend` `frontend` `fullstack` `mobile` `devops` `data` `ai-ml` `qa` `security` `design` `product` `project-management` `support` `other` |
| `seniority` | `intern` `junior` `mid` `senior` `lead` |
| `workMode` | `remote` `hybrid` `onsite` |
| `remoteScope` | `poland` `eu` `worldwide` — only when `workMode` is `remote` |
| `contractType` | `uop` (umowa o pracę) `b2b` `zlecenie` (umowa zlecenie) `dzielo` (umowa o dzieło) |
| `salaryBasis` | `gross` `net` — `net` for B2B means net of VAT |
| `salaryPeriod` | `month` `hour` `day` |
| `currency` | `PLN` `EUR` `USD` `GBP` `CHF` |
| `jobStatus` | `draft` `published` `closed` `expired` |
| `applicationStatus` | `saved` `applied` `interviewing` `offer` `rejected` `archived` |

Contract type and salary basis are **two separate dimensions of the data**, never one
combined field: a UoP offer and a B2B offer for the same job are two `SalaryOffer`s
(analysis §4).

### Shared shapes

```jsonc
// SalaryOffer — a range is mandatory: both bounds are required
{ "contractType": "b2b", "min": 18000, "max": 24000, "currency": "PLN",
  "period": "month", "basis": "net" }

// CompanyRef
{ "id": "guid", "slug": "acme-sp-z-o-o", "name": "Acme sp. z o.o.", "logoUrl": "https://…"|null, "isVerified": false }

// JobSummary
{ "id": "guid", "slug": "senior-backend-engineer-acme-1a2b3c", "title": "Senior Backend Engineer",
  "company": CompanyRef, "category": "backend", "seniority": "senior",
  "workMode": "remote", "remoteScope": "poland", "city": "Warszawa"|null,
  "salaries": [SalaryOffer], "skills": ["c#", "postgresql"],
  "isPromoted": false, "publishedAt": "…", "expiresAt": "…" }

// JobDetail = JobSummary +
{ "description": "markdown, ≤ 20 000 chars", "applyUrl": "https://…" }
```

## 3. Public endpoints

| Method + path | Notes |
|---|---|
| `GET /health`, `GET /alive` | From the kernel, **not** under `/api/v1`. `/health` = readiness and lists the state of every optional integration (§10); `/alive` = liveness |
| `GET /api/v1/jobs` | Search. Query below. Returns a page of `JobSummary`. Only `published` and not-expired jobs |
| `GET /api/v1/jobs/{slug}` | `JobDetail`, `404` for anything not published. Increments the view counter |
| `POST /api/v1/jobs/{slug}/apply-click` | Counts an apply click, returns `{ "applyUrl": "https://…" }`. Best-effort statistics, anonymous |
| `GET /api/v1/companies` | `?q=&verifiedOnly=&page=&limit=` → page of `CompanyRef` + `openJobs` count |
| `GET /api/v1/companies/{slug}` | `{ …CompanyRef, "website", "description", "city", "openJobs": [JobSummary] }` |
| `GET /api/v1/salaries/benchmarks` | Query below |
| `GET /api/v1/meta/filters` | Every vocabulary of §2 plus the cities that currently have a published job: `{ "categories": [...], "seniorities": [...], …, "cities": ["Warszawa", …] }` |
| `GET /api/v1/stats` | `{ "publishedJobs": n, "companies": n }` |

**`GET /api/v1/jobs` query**

| Param | Meaning |
|---|---|
| `q` | Case-insensitive substring over title, company name and skills |
| `category`, `seniority`, `workMode`, `remoteScope`, `contractType` | Comma-separated lists = OR within the parameter |
| `city` | Case-insensitive exact match |
| `skills` | Comma-separated; a job must carry **all** of them |
| `salaryMin`, `currency` | Jobs with at least one offer in `currency` (default `PLN`) whose **max**, normalised to a month (`hour × 168`, `day × 21`), is ≥ `salaryMin` |
| `verifiedOnly` | `true` → only jobs of verified companies |
| `sort` | `relevance` (default: promoted first, then newest), `newest`, `salary` (highest normalised max first) |
| `page`, `limit` | §1 |

**`GET /api/v1/salaries/benchmarks` query** — `title` (substring), `category`, `seniority`,
`contractType` (default `b2b`), `currency` (default `PLN`), `city`. All offers are normalised to a
month and **only offers with the basis implied by the contract type are compared** (`uop` →
`gross`, everything else → `net`), so gross and net never mix. Each offer contributes its
midpoint. Response:

```jsonc
{ "sampleSize": 14, "minimumSample": 3, "currency": "PLN", "contractType": "b2b",
  "basis": "net", "period": "month",
  "min": 12000, "p25": 17000, "median": 21000, "p75": 25000, "max": 32000 }
```

With fewer than `minimumSample` offers every statistic is `null` and only `sampleSize` is
reported — a "benchmark" of two listings identifies the listings.

## 4. Candidate endpoints (tracker)

Bearer required. A tracker row is the candidate's own note about a job; it contains no CV and
nothing is sent to the employer.

| Method + path | Notes |
|---|---|
| `GET /api/v1/tracker?status=` | `{ "items": [TrackedJob] }`, newest update first. `TrackedJob` = `{ "job": JobSummary, "status": applicationStatus, "notes": string, "appliedAt": …\|null, "updatedAt": … }`. Jobs that have since closed or expired are still returned, with their summary |
| `PUT /api/v1/tracker/{jobId}` | Upsert `{ "status": applicationStatus, "notes": string ≤ 2000 }` → `TrackedJob`. `appliedAt` is set the first time `status` becomes `applied` (or later). `404` if the job id is unknown or was never published |
| `DELETE /api/v1/tracker/{jobId}` | `204` |
| `GET /api/v1/me` | `{ "userId", "email", "roles": [...] }` from the token — no database read |
| `GET /api/v1/me/export` | RODO Art. 15/20: everything this service holds about the caller, as one JSON document: `{ "userId", "exportedAt", "tracker": [TrackedJob], "companies": [CompanyDetail], "jobs": [EmployerJob] }`. Served with `Content-Disposition: attachment; filename="work-in-poland-export.json"` |
| `DELETE /api/v1/me/data` | RODO Art. 17 for **this service's** data: body `{ "confirm": "delete-my-data" }` (anything else → `400`); deletes the caller's tracker rows, listings and companies (a published listing disappears from public reads at once) → `204`. It does **not** delete the account — that is authservice's `DELETE /api/v1/auth/account`, which the web app calls second. authservice has no deletion webhook, so nothing else tells this service an account is gone ([UI/UX backlog](../ux/UI-UX.md)) |

## 5. Employer endpoints

Bearer required. Ownership is `Company.ownerUserId == sub`; touching someone else's company or
job is `404`, never `403`, so ids cannot be probed.

```jsonc
// CompanyInput
{ "name": "Acme sp. z o.o.", "website": "https://acme.example", "description": "markdown ≤ 2000",
  "city": "Warszawa", "logoUrl": "https://…"|null, "nip": "5260250995"|null }

// CompanyDetail (employer view) = CompanyRef + CompanyInput fields + "createdAt"

// JobInput
{ "companyId": "guid", "title": "…", "description": "markdown", "category": "backend", "seniority": "senior",
  "workMode": "remote", "remoteScope": "poland", "city": null,
  "salaries": [SalaryOffer], "skills": ["c#"], "applyUrl": "https://…" }

// EmployerJob = JobDetail + { "status": jobStatus, "views": n, "applyClicks": n, "createdAt": …, "updatedAt": … }
//   (publishedAt/expiresAt are null while draft)
```

| Method + path | Notes |
|---|---|
| `GET /api/v1/employer/companies` | → `[CompanyDetail]` |
| `POST /api/v1/employer/companies` | `CompanyInput` → `201 CompanyDetail`. Slug is derived from the name and made unique |
| `PUT /api/v1/employer/companies/{id}` | `CompanyInput` → `CompanyDetail`. `isVerified` is untouched; changing `name` or `nip` clears verification |
| `GET /api/v1/employer/jobs` | `?companyId=&status=&page=&limit=` → page of `EmployerJob` |
| `POST /api/v1/employer/jobs` | `JobInput` + `"publish": bool` → `201 EmployerJob`. `publish: false` makes a draft |
| `GET /api/v1/employer/jobs/{id}` | `EmployerJob` |
| `PUT /api/v1/employer/jobs/{id}` | `JobInput` → `EmployerJob`. Allowed while `draft` or `published`; `409` once `closed` or `expired` |
| `POST /api/v1/employer/jobs/{id}/publish` | draft → published; sets `publishedAt` and `expiresAt = now + Jobs:ListingLifetimeDays` (default 30). Re-validates §7 |
| `POST /api/v1/employer/jobs/{id}/close` | published → closed |
| `POST /api/v1/employer/jobs/{id}/renew` | published, closed or expired → published, expiry = now + lifetime. Counts against the published-listing cap |
| `DELETE /api/v1/employer/jobs/{id}` | `204`, drafts only; `409` otherwise (a published listing is closed, not deleted) |

## 6. Admin endpoints

Bearer with role `Admin` or `SuperAdmin`. Everything here is written to the structured log
with the acting `sub`.

| Method + path | Notes |
|---|---|
| `GET /api/v1/admin/jobs` | `?status=&q=&page=&limit=` → page of `EmployerJob` (any company) |
| `POST /api/v1/admin/jobs/{id}/unpublish` | `{ "reason": string 1–500 }` → `EmployerJob` (status `closed`); the reason is kept on the row |
| `POST /api/v1/admin/jobs/{id}/promote` | `{ "days": 1–90 }` → `EmployerJob`; sets `isPromoted` until `now + days`. Payments are out of scope: promotion is granted by an operator ([ADR 0005](../adr/0005-no-payments-yet.md)) |
| `GET /api/v1/admin/companies` | `?q=&verified=&page=&limit=` → page of `CompanyDetail` |
| `POST /api/v1/admin/companies/{id}/verify` / `unverify` | → `CompanyDetail` |

## 7. Validation rules

Enforced by the API; the web client mirrors the limits for UX and the server is authoritative.

- `title` 5–120 chars. `description` 50–20 000. `applyUrl`: absolute `https` URL ≤ 500, no
  credentials in it. `website`, `logoUrl`: same rule, `logoUrl` optional.
- `skills`: 1–15 entries, each 1–40 chars; trimmed, lower-cased, de-duplicated.
- `workMode = remote` ⇒ `remoteScope` required, `city` optional. Otherwise `city` is required
  and `remoteScope` must be null.
- **Salary (the platform's one hard editorial rule, [ADR 0007](../adr/0007-mandatory-salary-ranges.md)):**
  1–4 `salaries`, **at most one per `contractType`**, each with `min > 0`, `max ≥ min`,
  `max ≤ 10 000 000`, and a `currency`, `period`, `basis` from §2. A listing without a range
  cannot be **published**.
- A **draft** is validated for shape only (types, enumerations, URL forms, max lengths), so an
  employer can save work in progress with an empty `salaries` list or a short `description`.
  `publish` (create with `publish: true`, the publish endpoint, or `renew`) runs every rule in
  this section.
- `nip`: optional; when present, 10 digits with a valid checksum. The employer view returns it,
  the public view never does.
- At most `Jobs:MaxPublishedPerCompany` (default 25) simultaneously published listings per
  company → `409`.

## 8. Authentication and authorization

- Two bearer schemes, **two audiences**, one issuer of keys:

  | Scheme | Used by | `iss` | `aud` |
  |---|---|---|---|
  | `Bearer` | the web BFF, calling `/api/v1/**` | `Jwt:Issuer` (`WorkInPoland`) | `Jwt:Audience` (`WorkInPoland`) |
  | `Mcp` | AI assistants, calling `/mcp/account` | the authservice public origin | `Mcp:ResourceUri` (the canonical URI of `/mcp/account`) |

  Both validate RS256 signatures against authservice's JWKS, discovered from its metadata
  (`/.well-known/openid-configuration` for `Bearer`, `/.well-known/oauth-authorization-server`
  for `Mcp`). This service holds **no key material and mints no token**. An MCP token is
  refused by `/api/v1/**` and a web token is refused by `/mcp/account`, because their
  audiences differ.
- Claims used: `sub` (user id), `email`, role (`http://schemas.microsoft.com/ws/2008/06/identity/claims/role`),
  and for MCP tokens `scope` (space-delimited) and `client_id`.
- Groups, visible in `Program.cs`: `public`, `authApi` (`RequireAuthorization()`), `adminApi`
  (`RequireRole("Admin", "SuperAdmin")`).
- Rate-limit partition: authenticated `sub`, falling back to the client IP read from
  `Network:ClientIpHeader` **only** when `Network:TrustProxyClientIpHeader` is `true`.

## 9. MCP

Two Streamable-HTTP endpoints on the API host, one adapter over the same services as the REST
endpoints ([ADR 0002](../adr/0002-mcp-is-an-adapter-inside-the-api.md)):

| Endpoint | Auth | Tools |
|---|---|---|
| `/mcp` | none — anonymous, read-only | `search_jobs`, `get_job_details`, `search_companies`, `get_company`, `get_salary_benchmarks`, `list_filter_values` |
| `/mcp/account` | OAuth 2.1 (authorization code + PKCE) via authservice | everything above **plus** the account tools below |

Tools are `snake_case`, take flat JSON arguments mirroring §3–§5, and return text content that is
the JSON of the REST response. Every tool has a description written for a model: what it does,
what the arguments mean, and what a result's fields are. A failed tool returns `isError` with a
sentence the model can act on; an unauthorized call to `/mcp/account` is an HTTP `401` with
`WWW-Authenticate: Bearer resource_metadata="<…>"`.

| Account tool | Required scope | REST equivalent |
|---|---|---|
| `track_job` (save a job, set status/notes) | `tracker:write` | `PUT /tracker/{jobId}` |
| `list_tracked_jobs` | `jobs:read` | `GET /tracker` |
| `untrack_job` | `tracker:write` | `DELETE /tracker/{jobId}` |
| `list_my_companies`, `create_company` | `employer:write` | §5 |
| `list_my_jobs`, `get_my_job` | `employer:write` | §5 |
| `post_job` (draft or publish), `update_job`, `publish_job`, `close_job`, `renew_job` | `employer:write` | §5 |

Scopes (registered in authservice, [ADR 0003](../adr/0003-authservice-is-the-identity-provider.md)):
`jobs:read`, `tracker:write`, `employer:write`, plus `offline_access` (authservice requires it).

Protected-resource metadata (RFC 9728) is served at
`/.well-known/oauth-protected-resource/mcp/account` (and the same document at
`/.well-known/oauth-protected-resource`): `resource` = `Mcp:ResourceUri`,
`authorization_servers` = `[<authservice public origin>]` — **first and only**, because Claude
uses the first entry and does not fall back — `scopes_supported` as above.

## 10. Configuration keys

Environment variables use `__` for `:`. Everything optional degrades (P8) and is reported by
`/health`.

| Key | Tier | Meaning / what degrades |
|---|---|---|
| `ConnectionStrings:apidb` | mode | Postgres connection string. Absent ⇒ InMemory database (tests, fresh clone). A secret on Fly |
| `DATABASE_PROVIDER` | mode | `PostgreSQL` (default when a connection string exists). `SqlServer` is **not supported** ([deviation register](../architecture/00-ARCHITECTURE.md)) |
| `Jwt:Authority` | always | Public origin of authservice (JWKS source) |
| `Jwt:Issuer`, `Jwt:Audience` | always | Both `WorkInPoland` |
| `Jwt:RequireHttpsMetadata` | tuning | Default `true`; applies to both bearer schemes. `false` only on a private network where authservice is reached over http (CI/e2e compose); `/health` reports `auth` as `configured (metadata over http - insecure)` then |
| `Mcp:ResourceUri` | optional | Canonical URI of `/mcp/account`. Absent ⇒ the account MCP endpoint and its metadata are **not mapped**; `/mcp` still works |
| `Mcp:AuthorizationServer` | with `Mcp:ResourceUri` | authservice's `Jwt:PublicBaseUrl` — the MCP-token issuer |
| `Cors:AllowedOrigins:<n>` | optional | Web origin(s). Same-origin BFF means this is rarely needed |
| `Network:ClientIpHeader`, `Network:TrustProxyClientIpHeader` | tuning | `Fly-Client-IP` / `true` on Fly only |
| `Jobs:ListingLifetimeDays`, `Jobs:MaxPublishedPerCompany` | tuning | 30 / 25 |
| `RateLimiting:ApiPermitsPerMinute`, `PublicPermitsPerMinute`, `GlobalPermitsPerMinute`, `MaxConcurrentRequests` | tuning | 240 / 120 / 600 / 200 per client per minute; the last is the process-wide concurrency bound |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional | Absent ⇒ no export; health probes are filtered out of traces regardless |

## 11. What the web BFF consumes from authservice

The browser only ever talks to the web app's own origin. The web app's server side calls
authservice (`AUTH_BASE_URL`) with these, all documented in authservice's own `README.md` and
`DEMO.md`:

| Purpose | authservice call |
|---|---|
| Consent versions for the register form | `GET /api/v1/auth/consents/versions` → `{ terms, privacy, cookies }` |
| Register | `POST /api/v1/auth/register` `{ email, password, acceptedTermsVersion, acceptedPrivacyVersion, locale }` → tokens, or `{ emailVerificationRequired: true, … }` |
| Sign in | `POST /api/v1/auth/login` `{ email, password }` → `{ accessToken, refreshToken, expiresIn }`, or `{ requiresTwoFactor: true, challengeToken }`, or `401`/`403` (`emailVerificationRequired`, `lockedOut`) |
| Second factor | `POST /api/v1/auth/2fa/login` `{ challengeToken, code }` or `{ challengeToken, recoveryCode }` |
| Refresh | `POST /api/v1/auth/refresh` `{ refreshToken }` — single-use rotation, store the new pair |
| Who am I, consent state | `GET /api/v1/auth/me` (bearer) → includes `requiresConsent`, `emailConfirmed` |
| Re-accept consent | `POST /api/v1/auth/consents` `{ acceptedTerms, acceptedPrivacy, locale }` (bearer) |
| Verify email / resend | `POST /api/v1/auth/verify-email` `{ email, token }`, `POST /api/v1/auth/resend-verification` `{ email }` |
| Password reset | `POST /api/v1/auth/forgot-password` `{ email }`, `POST /api/v1/auth/reset-password` `{ email, token, newPassword }` |
| Logout | `POST /api/v1/auth/logout` (bearer, revokes the refresh family) |
| Social login | `GET /api/v1/external-auth/providers` → configured providers; browser redirect to `GET /api/v1/external-auth/login?provider=…&returnUrl=<web>/oauth/callback`; the callback lands on the web app with `?code=`, redeemed with `POST /api/v1/external-auth/exchange` `{ code }` |

Authservice's emails link to `FrontendBaseUrl`: `<it>/reset-password?token=…&email=…` and
`<it>/verify-email?token=…&email=…`. The web app serves those routes.

The web BFF stores the token pair in `httpOnly`, `secure` (outside development),
`sameSite=strict` cookies, injects the access token as `Authorization: Bearer` when it proxies
to `/api/v1/**`, and verifies the JWT signature, issuer and audience in middleware.

## 12. Decisions the contract left open (as implemented)

- Request enumerations are strings, so an invalid value is a `400` `errors` entry, not a binding failure. Services run the §7 rules themselves, so REST and MCP behave identically.
- `JobInput.publish` is read on create only. Company input: `name` 2–120, `website` required https, `city` ≤ 100.
- The public company list, `GET /companies/{slug}` and `stats.companies` only include companies that have **ever published** a job (never-published → `404`).
- Tracker `appliedAt` is set the first time status becomes `applied`, `interviewing` or `offer`, and never moves. Omitting `notes` on upsert keeps the existing note.
- `renew` sets `publishedAt = now`. A listing unpublished by an admin cannot be renewed by its owner (`409`). `promote` needs a live published job (`409` otherwise).
- Bare `403`s carry a problem body; `401` has none. `sort=salary` ranks by the highest month-normalised max in the requested currency. The benchmark reads at most 5000 midpoints.
- MCP runs stateless Streamable HTTP (any Fly machine can answer). `/mcp/account` and its metadata are mapped only when both `Mcp:ResourceUri` and `Mcp:AuthorizationServer` are set; only the first set ⇒ `/health` `mcpAccount: "misconfigured (…)"`. There is deliberately no MCP tool for data export or deletion.
