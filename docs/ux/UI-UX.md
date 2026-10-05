# UI/UX — screens, flows, and the ranked backlog

The web app (`web/app`) is a Polish-language Next.js backend-for-frontend. This is the inventory of
what exists, what the first delivery decided and why, and what is left, ranked. Every backlog item
names the gap or principle it serves, so the next session picks it up instead of re-deriving it.

## Screens

| Route | Who | What |
|---|---|---|
| `/` | anyone | Hero, live stats, GET search form (filters live in the URL, so a search is shareable), job cards (salary per contract type with gross/net and period, skills, verified/promoted markers), pagination, empty and error states |
| `/oferty/[slug]` | anyone | Detail with safe markdown, all salary offers, **Aplikuj** (counts the click, then redirects to the employer's https page), save-to-tracker (anonymous → login with `?redirect=`), Google for Jobs `JobPosting` JSON-LD |
| `/firmy/[slug]` | anyone | Company and its open jobs |
| `/wynagrodzenia` | anyone | Salary benchmark: min / p25 / median / p75 / max as an SVG range, sample size, "Za mało danych (min. 3 oferty)" |
| `/mcp` | anyone | "Asystenci AI": the two endpoints, copyable snippets (addresses from runtime config), tools and scopes, honest note that the OAuth connector needs an operator-issued client |
| `/logowanie`, `/rejestracja`, `/reset-hasla`, `/reset-password`, `/verify-email`, `/oauth/callback`, `/zgody` | anyone / signed in | Sign-in (with TOTP or recovery code, lockout and unverified-email states, social buttons drawn from `/api/auth/providers`), register (consent versions read from authservice, never hard-coded), reset, verify, social callback, forced consent re-acceptance |
| `/konto` | candidate | Tracker grouped by status with notes, "no CV is stored" statement, and **Moje dane**: download export, typed-confirmation deletion (service data first, then the account) |
| `/konto/ustawienia` | signed in | Account settings: change password (with token reissue), 2FA enrollment/disable with recovery codes, profile (username update); sections hidden for OAuth-only accounts |
| `/pracodawca`, `/pracodawca/oferty/nowa`, `/pracodawca/oferty/[id]` | employer | Companies (NIP checksum), jobs table with views/apply-clicks and publish/close/renew/delete-draft, the job form (one salary row per contract type, skill chips, markdown preview, field errors from the API) |
| `/regulamin`, `/polityka-prywatnosci`, `/cookies` | anyone | **Drafts**, each with a visible "wymaga weryfikacji przez prawnika" banner; `/cookies` records the decision that only strictly necessary cookies are used, so no banner |
| `/admin`, `/admin/oferty`, `/admin/firmy`, (optionally `/admin/zgloszenia`) | admin | Protected: role `Admin`/`SuperAdmin` required; no role → 403 page. Dashboard with stats, listings management (unpublish with reason, promote), companies management (verify/unverify). Reports tab pending Phase 8 |
| `/healthz`, `/api/config`, `/sitemap.xml`, `/robots.txt`, error and not-found pages | infra | Dedicated health route (never the index page), runtime config, sitemap, Polish error pages |

## Decisions that shape the flows

- **The browser talks only to its own origin.** Tokens live in `httpOnly`, `SameSite=Strict` cookies set by BFF routes; client JS never sees one. Consequence: a cross-site link to `/konto` (for example from an email) lands on login first.
- **Middleware verifies, it does not decode** — signature, issuer and audience against authservice's JWKS, RS256 pinned; forged tokens are cleared and sent to login with `?redirect=`; a per-request CSP nonce means every page renders per request.
- **Apply is a redirect** ([ADR 0004](../adr/0004-apply-by-redirect.md)); the tracker is the candidate's own note.
- **The salary rule is explained in the form** ([ADR 0007](../adr/0007-mandatory-salary-ranges.md)) and stated as a product rule, not legal advice.
- **Refresh is serialised in-process** — hence one web instance in production ([deviation 5](../architecture/00-ARCHITECTURE.md#deviation-register)).

## Verified, and not

Playwright runs 36 tests against the real stack (Postgres, authservice, API, web) — anonymous search and
JSON-LD, the apply redirect, employer register → company → publish → public visibility, the candidate
tracker with persistence, the auth guard (redirect and return, forged cookie rejected, logout clears both
cookies), field-level validation, MCP, health, config, sitemap, account settings (password change, 2FA
enrollment/disable, profile update, recovery codes) — green in this session. **Not verified:**
social login against a real provider, the deletion flow end to end, production TLS/HSTS, and anything
in a browser other than Chromium.

## Completed (Phase 13)

| Item | Done |
|---|---|
| `/firmy` list page with search, verified filter, and pagination | ✅ |
| Company logo decision (ADR 0017: URL only, no upload) | ✅ |
| Employer job detail page: statistics (views, apply clicks, CTR, dates, renew action) | ✅ |
| JSON-LD improvements: baseSalary selection (highest PLN month-normalized), applicantLocationRequirements for remote scopes | ✅ |
| Polish pluralization function (`plural(n, [one, few, many])`) | ✅ |
| Dark theme: `prefers-color-scheme` + localStorage toggle with CSP nonce, AA contrast in both themes | ✅ |
| Tracker pluralization messages ("oferta/oferty/ofert") | ⏳ (function ready, awaiting UI integration) |
| Tracker pagination/show more and drag-and-drop with a11y | ⏳ (backlog, extraction needed) |
| Consent re-acceptance in middleware (vs client-side redirect) | ⏳ (backlog, extraction needed) |

## Backlog, ranked

| # | Item | Serves |
|---|---|---|
| 1 | **Run the deploy once** (first tag) and a public-URL walkthrough of register → publish → search | P12; the definition of done that this session could not reach |
| 2 | **Tested backups** for Postgres before the first real user | [`INFRASTRUCTURE-ANALYSIS.md`](../../flyio/INFRASTRUCTURE-ANALYSIS.md) |
| 3 | **Lawyer review of the three legal pages**, then bump `ConsentVersions` (authservice) and `CONSENT_*_VERSION` (web) together | [`NASTEPNE-KROKI.md`](../analysis/NASTEPNE-KROKI.md) §4 |
| 4 | **Reconcile deleted accounts**: authservice has no deletion webhook, so tracker rows and companies of a deleted account persist. Options: periodic reconciliation, or an authservice change | RODO Art. 17; [friction 3](../architecture/00-ARCHITECTURE.md#friction-with-authservice) |
| 5 | ~~**Admin UI** (verify companies, unpublish with reason, promote) over the existing `/api/v1/admin/*`~~ **DONE — Phase 10** | ADR 0005/0007; also pending: reports tab requires Phase 8 |
| 6 | **Employer-visible report/abuse flow** and a public "zgłoś ofertę" link; **admin reports queue** (Phase 8 API) | ADR 0010 (moderation), analysis §4 |
| 7 | **Make the OAuth MCP connector self-serve** (or ask authservice for public clients) | [ADR 0003](../adr/0003-authservice-is-the-identity-provider.md) friction 1 |
| 8 | **authservice's 20/min auth limiter vs one web address** — decide before concurrent sign-ins approach that | [friction 2](../architecture/00-ARCHITECTURE.md#friction-with-authservice) |
| 9 | Web telemetry (OTLP) and error tracking; export to a real collector from the API | P15 |
| 10 | Shared refresh lock so the web can scale past one instance | deviation 5 |
| 11 | Tracker: drag and drop with keyboard a11y (accessible drag-and-drop or equiv. select control); pagination/show more for long tracker lists | polish / a11y |
| 12 | Consent re-acceptance: move from client-side redirect (`/zgody?redirect=...`) to edge middleware to avoid page flicker | hardening |
