import { SignJWT, UnsecuredJWT, exportJWK, generateKeyPair, type JWK, type CryptoKey } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetJwksCache } from '@/lib/jwt';
import { middleware } from './middleware';

const AUTH = 'http://auth.test';
const env = process.env as Record<string, string | undefined>;

let signKey: CryptoKey;
let otherKey: CryptoKey;
let jwk: JWK;
let jwksRequests = 0;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  signKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  otherKey = (await generateKeyPair('RS256')).privateKey;
});

beforeEach(() => {
  env.AUTH_BASE_URL = AUTH;
  delete env.AUTH_ISSUER;
  delete env.AUTH_AUDIENCE;
  jwksRequests = 0;
  resetJwksCache();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === `${AUTH}/.well-known/jwks.json`) {
      jwksRequests++;
      return Response.json({ keys: [jwk] });
    }
    return new Response('nope', { status: 404 });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function token(opts: { key?: CryptoKey; iss?: string; aud?: string; exp?: number | string; kid?: string } = {}) {
  return new SignJWT({ sub: 'u1' })
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? 'k1' })
    .setIssuer(opts.iss ?? 'WorkInPoland')
    .setAudience(opts.aud ?? 'WorkInPoland')
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '10m')
    .sign(opts.key ?? signKey);
}

const req = (path: string, cookies: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
  });

const location = (res: Response) => res.headers.get('location') ?? '';
const isLoginRedirect = (res: Response) => res.status === 307 && new URL(location(res)).pathname === '/logowanie';
const clears = (res: Response, name: string) => (res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)) ?? '').includes('Max-Age=0');

describe('edge gate', () => {
  it('lets a valid token through and stamps a CSP nonce', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await middleware(req('/konto', { wip_at: await token() }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toMatch(/script-src 'self' 'nonce-[\w+/=]+'/);
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('content-security-policy')).not.toContain('unsafe-eval');
  });

  it('redirects anonymous visitors to login keeping path and query in ?redirect=', async () => {
    const res = await middleware(req('/konto?tab=2'));
    expect(isLoginRedirect(res)).toBe(true);
    expect(new URL(location(res)).searchParams.get('redirect')).toBe('/konto?tab=2');
  });

  it('keeps public routes and OAuth/verify/reset callbacks (with their query) open', async () => {
    for (const p of ['/', '/oferty/x', '/firmy/y', '/oauth/callback?code=abc', '/verify-email?token=t&email=e', '/reset-password?token=t&email=e', '/regulamin', '/healthz', '/api/config']) {
      const res = await middleware(req(p));
      expect(res.status, p).toBe(200);
    }
  });

  it('rejects and clears a forged token: valid payload with future exp, wrong signature', async () => {
    const forged = await token({ key: otherKey });
    const res = await middleware(req('/konto', { wip_at: forged, wip_rt: 'r' }));
    expect(isLoginRedirect(res)).toBe(true);
    expect(clears(res, 'wip_at')).toBe(true);
    expect(clears(res, 'wip_rt')).toBe(true);
  });

  it('rejects a base64 payload with a hand-made signature', async () => {
    const good = await token();
    const [h, p] = good.split('.');
    const res = await middleware(req('/konto', { wip_at: `${h}.${p}.AAAA` }));
    expect(isLoginRedirect(res)).toBe(true);
  });

  it('rejects a wrong issuer', async () => {
    expect(isLoginRedirect(await middleware(req('/konto', { wip_at: await token({ iss: 'Evil' }) })))).toBe(true);
  });

  it('rejects a wrong audience', async () => {
    expect(isLoginRedirect(await middleware(req('/konto', { wip_at: await token({ aud: 'Other' }) })))).toBe(true);
  });

  it('rejects alg=none', async () => {
    const unsecured = new UnsecuredJWT({ sub: 'u1' }).setIssuer('WorkInPoland').setAudience('WorkInPoland').setExpirationTime('10m').encode();
    expect(isLoginRedirect(await middleware(req('/konto', { wip_at: unsecured })))).toBe(true);
  });

  it('rejects HS256 signed with the public key material (algorithm confusion)', async () => {
    const secret = new TextEncoder().encode(JSON.stringify(jwk));
    const hs = await new SignJWT({ sub: 'u1' }).setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setIssuer('WorkInPoland').setAudience('WorkInPoland').setExpirationTime('10m').sign(secret);
    expect(isLoginRedirect(await middleware(req('/konto', { wip_at: hs })))).toBe(true);
  });

  it('rejects garbage', async () => {
    const res = await middleware(req('/konto', { wip_at: 'not-a-jwt' }));
    expect(isLoginRedirect(res)).toBe(true);
    expect(clears(res, 'wip_at')).toBe(true);
  });

  it('expired token + refresh cookie -> BFF refresh route (no JWKS call needed)', async () => {
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 120 });
    const res = await middleware(req('/pracodawca?x=1', { wip_at: expired, wip_rt: 'r' }));
    const url = new URL(location(res));
    expect(url.pathname).toBe('/api/auth/refresh');
    expect(url.searchParams.get('redirect')).toBe('/pracodawca?x=1');
    expect(jwksRequests).toBe(0);
  });

  it('expired token without refresh cookie -> login and cleared', async () => {
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 120 });
    const res = await middleware(req('/konto', { wip_at: expired }));
    expect(isLoginRedirect(res)).toBe(true);
    expect(clears(res, 'wip_at')).toBe(true);
  });

  it('refresh cookie only -> BFF refresh route', async () => {
    expect(new URL(location(await middleware(req('/konto', { wip_rt: 'r' })))).pathname).toBe('/api/auth/refresh');
  });

  it('does not loop: a refresh marker plus a still-unusable token goes to login', async () => {
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 120 });
    const res = await middleware(req('/konto', { wip_at: expired, wip_rt: 'r', wip_rf: '1' }));
    expect(isLoginRedirect(res)).toBe(true);
  });

  it('answers 503 (not a login bounce) when the JWKS cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('connect ECONNREFUSED'); }));
    resetJwksCache();
    const res = await middleware(req('/konto', { wip_at: await token() }));
    expect(res.status).toBe(503);
  });
});
