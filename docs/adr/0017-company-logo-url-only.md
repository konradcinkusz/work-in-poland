# ADR 0017 — Company logo as https URL only, validated client-side

**Status:** Accepted
**Date:** 2026-10-05

## Context

Company profiles display a logo. The schema allows either a URL or uploaded content.
Upload requires file storage infrastructure, RODO compliance for user-generated files
(Art. 6, 9, 32), security policies (malicious uploads, subdomain takeover if served same-origin),
and operator labor to evaluate reports. These are out of scope for the first delivery.

## Decision

Logo is a URL field: the employer provides an `https` URL to an image they control.
The field is optional. Validation:

- Must be absolute `https` URL (non-negotiable for CSP)
- URL length ≤ 500 chars (same as `applyUrl`)
- Served via `next/image` component with `remotePatterns` if static, else by the employer's origin

Content-Security-Policy:
- `img-src 'self' https:` (own origin + any https domain employer links to)

Accessibility and UX:
- Always provide an `alt` attribute (e.g., company name)
- Fallback to company name text when `logoUrl` is null or fails to load
- Client validates `https` scheme before sending to API

## Consequences

No upload infrastructure needed. The employer owns their image delivery, CDN, and liability.
The platform never holds files. A malicious link is flagged and the company is warned or
unpublished by an operator (human review, not automated).

**Reopen when** a paying customer requests uploads, and a file storage budget is approved by
leadership with a RODO impact assessment. The seam is `CompanyInput.logoUrl` (optional, URL →
optional, URL | FileId).
