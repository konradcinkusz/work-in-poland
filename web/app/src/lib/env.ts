/**
 * Server-side runtime configuration. Everything is read from `process.env` at call time —
 * never at module load and never through NEXT_PUBLIC_* — so one image serves every
 * environment (docs/standards FRONTEND-BFF §2).
 */

function trimSlash(v: string): string {
  return v.replace(/\/+$/, '');
}

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export const DEFAULT_CONSENT_VERSION = '2026-10-05';

export function authBaseUrl(): string {
  return trimSlash(opt('AUTH_BASE_URL') ?? 'http://localhost:8081');
}

/** Origin of authservice as seen by the browser (social-login redirect only). */
export function authPublicUrl(): string {
  return trimSlash(opt('AUTH_PUBLIC_URL') ?? authBaseUrl());
}

export function authIssuer(): string {
  return opt('AUTH_ISSUER') ?? 'WorkInPoland';
}

export function authAudience(): string {
  return opt('AUTH_AUDIENCE') ?? 'WorkInPoland';
}

export function publicApiUrl(): string {
  return trimSlash(opt('PUBLIC_API_URL') ?? 'http://localhost:8080');
}

export function publicSiteUrl(): string {
  return trimSlash(opt('PUBLIC_SITE_URL') ?? 'http://localhost:3000');
}

export function consentVersions(): { terms: string; privacy: string } {
  return {
    terms: opt('CONSENT_TERMS_VERSION') ?? DEFAULT_CONSENT_VERSION,
    privacy: opt('CONSENT_PRIVACY_VERSION') ?? DEFAULT_CONSENT_VERSION,
  };
}

/** `auto` (default): Secure unless NODE_ENV=development. */
export function cookieSecure(): boolean {
  const v = (opt('SESSION_COOKIE_SECURE') ?? 'auto').toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return process.env.NODE_ENV !== 'development';
}

/** Ordered candidate base URLs of the API: explicit env, Aspire discovery, internal DNS, localhost. */
export function apiCandidates(): string[] {
  const list = [
    opt('API_BASE_URL'),
    opt('services__api__https__0'),
    opt('services__api__http__0'),
    'http://api:8080',
    'http://localhost:8080',
  ]
    .filter((v): v is string => !!v)
    .map(trimSlash);
  return [...new Set(list)];
}
