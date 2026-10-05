import { createRemoteJWKSet, decodeJwt, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { authAudience, authBaseUrl, authIssuer } from './env';

export type VerifyResult =
  | { status: 'valid'; payload: JWTPayload }
  /** Signature, issuer and audience are fine but `exp` has passed: a refresh may recover it. */
  | { status: 'expired' }
  /** Bad signature, wrong issuer/audience, wrong algorithm, malformed: never recoverable. */
  | { status: 'invalid' }
  /** The JWKS could not be fetched; we cannot say either way. */
  | { status: 'unavailable' };

const jwksCache = new Map<string, JWTVerifyGetKey>();

export function jwksUrl(): string {
  return `${authBaseUrl()}/.well-known/jwks.json`;
}

export function getRemoteJwks(): JWTVerifyGetKey {
  const url = jwksUrl();
  let jwks = jwksCache.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url), { timeoutDuration: 5000, cooldownDuration: 10_000, cacheMaxAge: 10 * 60_000 });
    jwksCache.set(url, jwks);
  }
  return jwks;
}

export function resetJwksCache(): void {
  jwksCache.clear();
}

/**
 * Cheap, UNVERIFIED read of `exp` (seconds since epoch). Only ever used as a fast path to skip
 * work; it never grants access. Returns null for anything that does not parse as a JWT.
 */
export function decodeExp(token: string): number | null {
  try {
    const exp = decodeJwt(token).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Full verification: signature against authservice's JWKS, issuer, audience, expiry.
 * Algorithms are pinned to RS256, so `alg: none` and HS256-with-the-public-key confusion are rejected.
 */
export async function verifyAccessToken(token: string, keys: JWTVerifyGetKey = getRemoteJwks()): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: authIssuer(),
      audience: authAudience(),
      algorithms: ['RS256'],
    });
    return { status: 'valid', payload };
  } catch (e) {
    if (e instanceof errors.JWTExpired) return { status: 'expired' };
    if (e instanceof errors.JWKSTimeout || e instanceof TypeError || (e instanceof Error && e.name === 'FetchError')) {
      return { status: 'unavailable' };
    }
    return { status: 'invalid' };
  }
}
