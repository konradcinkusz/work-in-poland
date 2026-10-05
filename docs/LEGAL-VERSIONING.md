# Legal Documents and Consent Version Management

This document describes how legal document versions are managed in the work-in-poland system.

## Overview

The system maintains three legal documents with versioning:
1. **Terms of Service** (Regulamin)
2. **Privacy Policy** (Polityka prywatności)
3. **Cookie Policy** (Polityka cookies)

When a user logs in or registers, they must accept the current versions. If the versions change, returning users are asked to re-accept on their next login.

## Version Format

Versions are date-based strings in ISO-8601 format: `YYYY-MM-DD` (e.g., `2026-10-05`).

## Where Versions Are Set (4 Places)

Versions must be kept **synchronized across all four locations** — any mismatch breaks user registration.

### 1. authservice Configuration (`flyio/authservice.fly.toml`)

Three environment variables control the versions that authservice requires:

```toml
ConsentVersions__Terms = "2026-10-05"
ConsentVersions__Privacy = "2026-10-05"
ConsentVersions__Cookies = "2026-10-05"
```

These versions are returned by:
- `GET /api/v1/auth/consents/versions` — the web app calls this to know which versions to display
- `/consents` and `/consents/versions` endpoints used during registration

### 2. Web App Configuration (`flyio/web.fly.toml`)

The web app stores the current versions as environment variables:

```toml
CONSENT_TERMS_VERSION = "2026-10-05"
CONSENT_PRIVACY_VERSION = "2026-10-05"
CONSENT_COOKIES_VERSION = "2026-10-05"
```

These are injected into the web app at runtime (not baked into the build) and read by:
- `web/app/src/lib/env.ts` → `consentVersions()` function
- Legal page components to display the version string

**Note:** These must match the authservice versions, or users cannot register.

### 3. Docker Compose for E2E Tests (`tests/e2e/docker-compose.yml`)

The e2e test stack must use the same versions:

```yaml
# authservice service environment
environment:
  ConsentVersions__Terms: "2026-10-05"
  ConsentVersions__Privacy: "2026-10-05"
  ConsentVersions__Cookies: "2026-10-05"

# web service environment
environment:
  CONSENT_TERMS_VERSION: "2026-10-05"
  CONSENT_PRIVACY_VERSION: "2026-10-05"
  CONSENT_COOKIES_VERSION: "2026-10-05"
```

### 4. Consent Version Check Script (`scripts/check-consent-versions.mjs`)

A CI job runs `node scripts/check-consent-versions.mjs` to verify all four places match.
If they differ, the job fails and blocks CI.

## How to Bump a Version

When the legal text changes (after lawyer review):

1. **Update the text** in the corresponding markdown file under `web/app/content/legal/`:
   - `terms.pl.md` → `regulamin` page
   - `privacy.pl.md` → `polityka-prywatności` page
   - `cookies.pl.md` → `cookies` page

2. **Choose a new version date** (e.g., today's date in `YYYY-MM-DD` format)

3. **Update all four locations** with the new version:
   - `flyio/authservice.fly.toml`
   - `flyio/web.fly.toml`
   - `tests/e2e/docker-compose.yml`
   - (The version check script runs in CI and verifies this)

4. **Commit the changes** with a clear message, e.g.:
   ```
   Update legal documents: terms to 2026-10-10
   
   - Update regulatory text (reviewed by [lawyer])
   - Bump ConsentVersions__Terms to 2026-10-10 in all four places
   - Users will be asked to re-accept on next login
   ```

5. **Verify locally** that the consent version check passes:
   ```bash
   node scripts/check-consent-versions.mjs
   ```

## What Happens When Versions Change

1. Authservice tracks the accepted version in each user's account record
2. When a user logs in, authservice checks if their accepted version matches the current version
3. If versions don't match, authservice returns `"requiresConsent": true` in the auth token claims
4. The web app checks this claim and redirects the user to `/zgody` (consent gate) on next page load
5. The user sees the updated legal documents and must click "Accept" to proceed

## Content Location

Legal document content is stored as **markdown files**, not embedded in the code:

```
web/app/content/legal/
├── terms.pl.md          # Regulamin
├── privacy.pl.md        # Polityka prywatności
└── cookies.pl.md        # Polityka cookies
```

These files are loaded by the legal page routes at build time and rendered to users.

**Why markdown, not TSX?**
- Separates content from code
- Easier for lawyers to review and edit
- No code review friction for pure content updates
- Clearer diff history

## Cookies Policy Special Case

**Note:** Authservice currently has no separate consent version for cookies; it reuses the privacy policy version. The `cookies.pl.md` file is maintained separately for documentation clarity, but `CONSENT_COOKIES_VERSION` in the web config is provided for future compatibility.

If authservice is updated to support separate cookie versions, no code changes will be needed — only the configuration.

## Verification Checklist

Before deploying a new version:

- [ ] All four locations have the same version string
- [ ] `node scripts/check-consent-versions.mjs` passes
- [ ] Markdown files are syntactically valid and link-checked (`node scripts/check-links.mjs`)
- [ ] Content accurately describes what the system does (confirm with code review)
- [ ] Lawyer has reviewed the new text
- [ ] Commit message is clear and links to the review/approval source

---

**See also:** `docs/analysis/NASTEPNE-KROKI.md` §4 for legal questions that required a lawyer's input.
