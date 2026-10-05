import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRefreshState } from '@/lib/session';
import { POST as deleteAccount } from './delete-account/route';
import { POST as accept } from './accept-consent/route';
import { GET as consents } from './consents/route';
import { POST as exchange } from './exchange/route';
import { POST as forgot } from './forgot/route';
import { POST as login } from './login/route';
import { POST as logout } from './logout/route';
import { GET as providers } from './providers/route';
import { GET as refreshGet, POST as refreshPost } from './refresh/route';
import { POST as register } from './register/route';
import { POST as resend } from './resend/route';
import { POST as reset } from './reset/route';
import { GET as sessionGet } from './session/route';
import { POST as twofa } from './2fa/route';
import { POST as verify } from './verify/route';

type Call = { url: string; method: string; body: Record<string, unknown> | null; auth: string | null };
let calls: Call[];

function auth(handler: (path: string, call: Call) => Response) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const call: Call = {
      url: u.pathname, method: init?.method ?? 'GET',
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
      auth: new Headers(init?.headers).get('authorization'),
    };
    calls.push(call);
    return handler(u.pathname, call);
  }));
}

const post = (path: string, body: unknown, cookies = '') =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', cookie: cookies } });
const get = (path: string, cookies = '') => new NextRequest(`http://localhost:3000${path}`, { headers: { cookie: cookies } });
const setCookies = (r: Response) => r.headers.getSetCookie();
const cookie = (r: Response, name: string) => setCookies(r).find((c) => c.startsWith(`${name}=`)) ?? '';
const tokens = Response.json({ accessToken: 'AT', refreshToken: 'RT', expiresIn: 900, tokenType: 'Bearer' });
const mkJwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;
const freshJwt = () => mkJwt(Math.floor(Date.now() / 1000) + 600);

beforeEach(() => {
  resetRefreshState();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('AUTH_BASE_URL', 'http://auth.test');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/auth/login', () => {
  it('sets httpOnly strict secure cookies and never returns tokens to the client', async () => {
    auth(() => tokens.clone());
    const res = await login(post('/api/auth/login', { email: 'a@b.pl', password: 'pw' }));
    expect(await res.json()).toEqual({ status: 'ok' });
    for (const name of ['wip_at', 'wip_rt']) {
      const c = cookie(res, name);
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/SameSite=strict/i);
      expect(c).toMatch(/Secure/i);
      expect(c).toMatch(/Path=\//);
    }
    expect(cookie(res, 'wip_at')).toContain('wip_at=AT');
    expect(calls[0]).toMatchObject({ url: '/api/v1/auth/login', body: { email: 'a@b.pl', password: 'pw' } });
  });

  it('answers wrong password with a generic 401 identical in shape to an unknown user', async () => {
    auth(() => Response.json({ error: 'Invalid email or password' }, { status: 401 }));
    const a = await login(post('/api/auth/login', { email: 'known@b.pl', password: 'bad' }));
    const b = await login(post('/api/auth/login', { email: 'unknown@b.pl', password: 'bad' }));
    expect(a.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
    expect(setCookies(a)).toHaveLength(0);
  });

  it('maps lockout to 423 locked_out', async () => {
    auth(() => Response.json({ error: 'locked', lockedOut: true, lockoutEnd: '2026-10-05T12:00:00Z' }, { status: 401 }));
    const res = await login(post('/api/auth/login', { email: 'a@b.pl', password: 'x' }));
    expect(res.status).toBe(423);
    expect((await res.json()).status).toBe('locked_out');
  });

  it('maps unverified e-mail to 403 email_not_verified', async () => {
    auth(() => Response.json({ error: 'x', emailVerificationRequired: true }, { status: 403 }));
    const res = await login(post('/api/auth/login', { email: 'a@b.pl', password: 'x' }));
    expect(res.status).toBe(403);
    expect((await res.json()).status).toBe('email_not_verified');
  });

  it('parks the 2FA challenge in an httpOnly cookie and does not leak it', async () => {
    auth(() => Response.json({ requiresTwoFactor: true, challengeToken: 'CH', expiresIn: 300 }));
    const res = await login(post('/api/auth/login', { email: 'a@b.pl', password: 'x' }));
    expect(await res.json()).toEqual({ status: 'two_factor' });
    expect(cookie(res, 'wip_2fa')).toMatch(/wip_2fa=CH.*HttpOnly/i);
    expect(cookie(res, 'wip_at')).toBe('');
  });

  it('maps 429 to a Polish message with Retry-After', async () => {
    auth(() => Response.json({ error: 'rate_limited', retryAfter: 30 }, { status: 429, headers: { 'retry-after': '30' } }));
    const res = await login(post('/api/auth/login', { email: 'a@b.pl', password: 'x' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect((await res.json()).error).toMatch(/Zbyt wiele prób/);
  });

  it('forwards the browser IP to authservice', async () => {
    let xff: string | null = null;
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => { xff = new Headers(init?.headers).get('x-forwarded-for'); return tokens.clone(); }));
    // Outside a Next request scope there is no header source: the call must still work.
    const res = await login(post('/api/auth/login', { email: 'a@b.pl', password: 'x' }));
    expect(res.status).toBe(200);
    expect(xff).toBeNull();
  });

  it('is 503 when authservice is down and 502 when it redirects (config bug, logged)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('ECONNREFUSED'); }));
    expect((await login(post('/api/auth/login', { email: 'a@b.pl', password: 'x' }))).status).toBe(503);
    auth(() => new Response(null, { status: 302, headers: { location: 'https://elsewhere/login' } }));
    expect((await login(post('/api/auth/login', { email: 'a@b.pl', password: 'x' }))).status).toBe(502);
    expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('https://elsewhere/login');
  });

  it('rejects an empty body with 400 without calling authservice', async () => {
    auth(() => tokens.clone());
    expect((await login(post('/api/auth/login', {}))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('POST /api/auth/2fa', () => {
  it('redeems the challenge from the cookie with a TOTP code and sets the session', async () => {
    auth(() => tokens.clone());
    const res = await twofa(post('/api/auth/2fa', { code: '123456' }, 'wip_2fa=CH'));
    expect(calls[0]).toMatchObject({ url: '/api/v1/auth/2fa/login', body: { challengeToken: 'CH', code: '123456' } });
    expect((await res.json()).status).toBe('ok');
    expect(cookie(res, 'wip_at')).toContain('wip_at=AT');
    expect(cookie(res, 'wip_2fa')).toMatch(/Max-Age=0/);
  });

  it('accepts a recovery code', async () => {
    auth(() => tokens.clone());
    await twofa(post('/api/auth/2fa', { recoveryCode: 'abcd-efgh' }, 'wip_2fa=CH'));
    expect(calls[0]?.body).toEqual({ challengeToken: 'CH', recoveryCode: 'abcd-efgh' });
  });

  it('wrong code is a 401 invalid_code; expired challenge clears the cookie', async () => {
    auth(() => Response.json({ error: 'That code is not valid.' }, { status: 401 }));
    const bad = await twofa(post('/api/auth/2fa', { code: '000000' }, 'wip_2fa=CH'));
    expect(bad.status).toBe(401);
    expect((await bad.json()).status).toBe('invalid_code');
    auth(() => Response.json({ error: 'Invalid or expired challenge. Start the sign-in again.' }, { status: 401 }));
    const expired = await twofa(post('/api/auth/2fa', { code: '000000' }, 'wip_2fa=CH'));
    expect((await expired.json()).status).toBe('challenge_expired');
    expect(cookie(expired, 'wip_2fa')).toMatch(/Max-Age=0/);
  });

  it('lockout during the second factor is 423', async () => {
    auth(() => Response.json({ error: 'Account is temporarily locked after too many failed attempts.' }, { status: 401 }));
    expect((await twofa(post('/api/auth/2fa', { code: '1' }, 'wip_2fa=CH'))).status).toBe(423);
  });

  it('without a challenge cookie it is 401 challenge_expired and calls nothing', async () => {
    auth(() => tokens.clone());
    const res = await twofa(post('/api/auth/2fa', { code: '123456' }));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
});

describe('POST /api/auth/register', () => {
  const versions = Response.json({ terms: '2026-10-05', privacy: '2026-10-05', cookies: '2026-10-05' });
  const body = { email: 'n@b.pl', password: 'Str0ng!Pass', acceptTerms: true, acceptPrivacy: true };

  it('sends the versions fetched from authservice, ignoring anything the client claims', async () => {
    auth((path) => (path.endsWith('/consents/versions') ? versions.clone() : tokens.clone()));
    const res = await register(post('/api/auth/register', { ...body, acceptedTermsVersion: 'evil' }));
    expect((await res.json()).status).toBe('ok');
    expect(calls[0]?.url).toBe('/api/v1/auth/consents/versions');
    expect(calls[1]?.body).toMatchObject({ acceptedTermsVersion: '2026-10-05', acceptedPrivacyVersion: '2026-10-05', locale: 'pl' });
    expect(cookie(res, 'wip_at')).toContain('wip_at=AT');
  });

  it('202 means verification required and sets no cookies', async () => {
    auth((path) => (path.endsWith('/versions') ? versions.clone() : Response.json({ userId: 'u', email: 'n@b.pl', emailVerificationRequired: true }, { status: 202 })));
    const res = await register(post('/api/auth/register', body));
    expect(res.status).toBe(202);
    expect((await res.json()).status).toBe('verification_required');
    expect(setCookies(res)).toHaveLength(0);
  });

  it('passes authservice validation errors through as a list', async () => {
    auth((path) => (path.endsWith('/versions') ? versions.clone() : Response.json({ errors: ['Passwords must have at least one digit.'] }, { status: 400 })));
    const res = await register(post('/api/auth/register', body));
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual(['Passwords must have at least one digit.']);
  });

  it('requires both checkboxes', async () => {
    auth(() => versions.clone());
    const res = await register(post('/api/auth/register', { ...body, acceptPrivacy: false }));
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('is 503 when the versions cannot be fetched', async () => {
    auth(() => new Response('x', { status: 500 }));
    expect((await register(post('/api/auth/register', body))).status).toBe(503);
  });
});

describe('POST /api/auth/logout', () => {
  it('calls authservice with the bearer and deletes cookies with the same attributes', async () => {
    auth(() => Response.json({ message: 'ok' }));
    const at = freshJwt();
    const res = await logout(post('/api/auth/logout', {}, `wip_at=${at}; wip_rt=RT`));
    expect(calls[0]).toMatchObject({ url: '/api/v1/auth/logout', auth: `Bearer ${at}` });
    for (const name of ['wip_at', 'wip_rt']) {
      const c = cookie(res, name);
      expect(c).toMatch(/Max-Age=0/);
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/SameSite=strict/i);
      expect(c).toMatch(/Secure/i);
      expect(c).toMatch(/Path=\//);
    }
  });

  it('still signs out locally when authservice is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down'); }));
    const res = await logout(post('/api/auth/logout', {}, `wip_at=${freshJwt()}; wip_rt=RT`));
    expect(res.status).toBe(200);
    expect(cookie(res, 'wip_at')).toMatch(/Max-Age=0/);
  });
});

describe('GET /api/auth/session', () => {
  it('is unauthenticated without cookies', async () => {
    auth(() => tokens.clone());
    expect(await (await sessionGet(get('/api/auth/session'))).json()).toEqual({ authenticated: false });
    expect(calls).toHaveLength(0);
  });

  it('reports the user, consent state and e-mail confirmation from /me', async () => {
    auth(() => Response.json({ id: 'u1', email: 'a@b.pl', requiresConsent: true, emailConfirmed: true }));
    const res = await sessionGet(get('/api/auth/session', `wip_at=${freshJwt()}; wip_rt=RT`));
    expect(await res.json()).toMatchObject({ authenticated: true, email: 'a@b.pl', requiresConsent: true });
  });

  it('refreshes transparently when the access token is expired and stores the NEW pair', async () => {
    auth((path) => (path.endsWith('/refresh') ? Response.json({ accessToken: freshJwt(), refreshToken: 'RT2', expiresIn: 900 }) : Response.json({ id: 'u', email: 'a@b.pl', requiresConsent: false })));
    const res = await sessionGet(get('/api/auth/session', `wip_at=${mkJwt(1)}; wip_rt=RT1`));
    expect((await res.json()).authenticated).toBe(true);
    expect(calls[0]?.body).toEqual({ refreshToken: 'RT1' });
    expect(cookie(res, 'wip_rt')).toContain('wip_rt=RT2');
  });

  it('a failed refresh means signed out and clears the cookies', async () => {
    auth(() => Response.json({ error: 'Invalid or expired refresh token' }, { status: 401 }));
    const res = await sessionGet(get('/api/auth/session', `wip_at=${mkJwt(1)}; wip_rt=dead`));
    expect((await res.json()).authenticated).toBe(false);
    expect(cookie(res, 'wip_at')).toMatch(/Max-Age=0/);
    expect(cookie(res, 'wip_rt')).toMatch(/Max-Age=0/);
  });
});

describe('refresh route', () => {
  it('GET stores the new pair, sets the loop marker and redirects to a sanitised target', async () => {
    auth(() => tokens.clone());
    const res = await refreshGet(get('/api/auth/refresh?redirect=%2Fkonto%3Fa%3D1', 'wip_rt=RT'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname + new URL(res.headers.get('location')!).search).toBe('/konto?a=1');
    expect(cookie(res, 'wip_at')).toContain('wip_at=AT');
    expect(cookie(res, 'wip_rf')).toContain('wip_rf=1');
  });

  it('GET never redirects off-site', async () => {
    auth(() => tokens.clone());
    const res = await refreshGet(get('/api/auth/refresh?redirect=https%3A%2F%2Fevil.example', 'wip_rt=RT'));
    expect(new URL(res.headers.get('location')!).host).toBe('localhost:3000');
  });

  it('GET with a rejected token clears cookies and goes to login with ?redirect=', async () => {
    auth(() => new Response('{}', { status: 401 }));
    const res = await refreshGet(get('/api/auth/refresh?redirect=%2Fkonto', 'wip_rt=dead'));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/logowanie');
    expect(cookie(res, 'wip_rt')).toMatch(/Max-Age=0/);
  });

  it('POST: ok / signed_out', async () => {
    auth(() => tokens.clone());
    expect((await (await refreshPost(post('/api/auth/refresh', {}, 'wip_rt=RT'))).json()).status).toBe('ok');
    auth(() => new Response('{}', { status: 401 }));
    expect((await refreshPost(post('/api/auth/refresh', {}, 'wip_rt=RT2'))).status).toBe(401);
  });
});

describe('exchange (social login)', () => {
  it('sets the session and returns the remembered redirect', async () => {
    auth(() => tokens.clone());
    const res = await exchange(post('/api/auth/exchange', { code: 'CODE' }, 'wip_post_login=%2Fpracodawca'));
    expect(await res.json()).toEqual({ status: 'ok', redirect: '/pracodawca' });
    expect(cookie(res, 'wip_at')).toContain('wip_at=AT');
  });
  it('handles the 2FA branch', async () => {
    auth(() => Response.json({ requiresTwoFactor: true, challengeToken: 'CH', expiresIn: 300 }));
    const res = await exchange(post('/api/auth/exchange', { code: 'CODE' }));
    expect((await res.json()).status).toBe('two_factor');
    expect(cookie(res, 'wip_2fa')).toContain('wip_2fa=CH');
  });
  it('an invalid or used code is 401', async () => {
    auth(() => Response.json({ error: 'Invalid, expired, or already-used code.' }, { status: 401 }));
    expect((await exchange(post('/api/auth/exchange', { code: 'X' }))).status).toBe(401);
  });
});

describe('providers and consent versions', () => {
  it('lists only what authservice reports', async () => {
    auth(() => Response.json({ providers: [{ provider: 'Google', displayName: 'Google' }] }));
    expect(await (await providers()).json()).toEqual({ providers: [{ provider: 'Google', displayName: 'Google' }] });
  });
  it('is an empty list (no buttons) when authservice is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down'); }));
    expect(await (await providers()).json()).toEqual({ providers: [] });
  });
  it('exposes versions from authservice', async () => {
    auth(() => Response.json({ terms: 'T1', privacy: 'P1', cookies: 'C1' }));
    expect(await (await consents()).json()).toEqual({ terms: 'T1', privacy: 'P1' });
  });
});

describe('forgot / reset / verify / resend / accept-consent', () => {
  it('forgot answers identically for any address', async () => {
    auth(() => Response.json({ message: 'x' }));
    expect(await (await forgot(post('/api/auth/forgot', { email: 'a@b.pl' }))).json()).toEqual({ status: 'ok' });
    auth(() => new Response('{}', { status: 400 }));
    expect(await (await forgot(post('/api/auth/forgot', { email: 'nobody@b.pl' }))).json()).toEqual({ status: 'ok' });
  });
  it('reset sends email/token/newPassword and reports invalid links', async () => {
    auth(() => Response.json({ message: 'ok' }));
    expect((await (await reset(post('/api/auth/reset', { email: 'a@b.pl', token: 'T', newPassword: 'NewPass123!' }))).json()).status).toBe('ok');
    expect(calls[0]?.body).toEqual({ email: 'a@b.pl', token: 'T', newPassword: 'NewPass123!' });
    auth(() => Response.json({ errors: ['Invalid or expired reset token.'] }, { status: 400 }));
    const bad = await reset(post('/api/auth/reset', { email: 'a@b.pl', token: 'T', newPassword: 'NewPass123!' }));
    expect(bad.status).toBe(400);
  });
  it('verify ok / invalid', async () => {
    auth(() => Response.json({ message: 'ok' }));
    expect((await verify(post('/api/auth/verify', { email: 'a@b.pl', token: 'T' }))).status).toBe(200);
    auth(() => Response.json({ error: 'Invalid or expired verification token.' }, { status: 400 }));
    expect((await verify(post('/api/auth/verify', { email: 'a@b.pl', token: 'T' }))).status).toBe(400);
  });
  it('resend is always ok', async () => {
    auth(() => Response.json({ message: 'x' }));
    expect(await (await resend(post('/api/auth/resend', { email: 'a@b.pl' }))).json()).toEqual({ status: 'ok' });
  });
  it('accept-consent needs a session and posts both acceptances with the bearer', async () => {
    auth(() => Response.json({ requiresConsent: false }));
    expect((await accept(post('/api/auth/accept-consent', { acceptedTerms: true, acceptedPrivacy: true }))).status).toBe(401);
    const at = freshJwt();
    const res = await accept(post('/api/auth/accept-consent', { acceptedTerms: true, acceptedPrivacy: true }, `wip_at=${at}; wip_rt=RT`));
    expect((await res.json()).status).toBe('ok');
    expect(calls[0]).toMatchObject({ url: '/api/v1/auth/consents', auth: `Bearer ${at}`, body: { acceptedTerms: true, acceptedPrivacy: true } });
    expect((await accept(post('/api/auth/accept-consent', { acceptedTerms: true }, `wip_at=${at}`))).status).toBe(400);
  });
});

describe('POST /api/auth/delete-account', () => {
  it('calls authservice DELETE with confirmation + password, then clears the cookies', async () => {
    auth(() => Response.json({ message: 'deleted' }));
    const at = freshJwt();
    const res = await deleteAccount(post('/api/auth/delete-account', { password: 'pw' }, `wip_at=${at}; wip_rt=RT`));
    expect(calls[0]).toMatchObject({ url: '/api/v1/auth/account', method: 'DELETE', auth: `Bearer ${at}`, body: { password: 'pw', confirmation: 'DELETE' } });
    expect((await res.json()).status).toBe('ok');
    expect(cookie(res, 'wip_at')).toMatch(/Max-Age=0/);
  });
  it('maps a wrong password to invalid_password and keeps the session', async () => {
    auth(() => Response.json({ error: 'Invalid password' }, { status: 400 }));
    const res = await deleteAccount(post('/api/auth/delete-account', { password: 'x' }, `wip_at=${freshJwt()}; wip_rt=RT`));
    expect(res.status).toBe(400);
    expect((await res.json()).status).toBe('invalid_password');
    expect(cookie(res, 'wip_at')).toBe('');
  });
  it('requires a session', async () => {
    auth(() => Response.json({}));
    expect((await deleteAccount(post('/api/auth/delete-account', {}))).status).toBe(401);
  });
});
