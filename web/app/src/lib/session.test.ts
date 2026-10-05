import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshTokens, resetRefreshState, resolveAccess } from './session';

const calls: string[] = [];
function stubAuth(handler: (n: number, body: { refreshToken: string }) => Response | Promise<Response>) {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(url));
    const body = JSON.parse(String(init?.body ?? '{}')) as { refreshToken: string };
    return handler(calls.length, body);
  }));
}

beforeEach(() => resetRefreshState());
afterEach(() => vi.unstubAllGlobals());

const pair = (n: number) => Response.json({ accessToken: `a${n}`, refreshToken: `r${n}`, expiresIn: 900 });

describe('refresh serialisation', () => {
  it('two parallel refreshes with the same single-use token call authservice ONCE and both get the new pair', async () => {
    stubAuth(async (n) => {
      await new Promise((r) => setTimeout(r, 20));
      return n === 1 ? pair(1) : new Response(JSON.stringify({ error: 'Invalid or expired refresh token' }), { status: 401 });
    });
    const [x, y] = await Promise.all([refreshTokens('old'), refreshTokens('old')]);
    expect(calls).toHaveLength(1);
    expect(x).toEqual({ kind: 'ok', tokens: { accessToken: 'a1', refreshToken: 'r1' } });
    expect(y).toEqual(x);
  });

  it('a late request still carrying the old cookie gets the stored result, not a second (failing) rotation', async () => {
    stubAuth((n) => (n === 1 ? pair(1) : new Response('{}', { status: 401 })));
    await refreshTokens('old');
    const late = await refreshTokens('old');
    expect(calls).toHaveLength(1);
    expect(late.kind).toBe('ok');
  });

  it('a rejected refresh means signed out ("invalid"), and is not cached as success', async () => {
    stubAuth(() => new Response(JSON.stringify({ error: 'Invalid' }), { status: 401 }));
    expect((await refreshTokens('bad')).kind).toBe('invalid');
    expect((await refreshTokens('bad')).kind).toBe('invalid');
    expect(calls).toHaveLength(2);
  });

  it('an unreachable authservice is "unavailable", not signed out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down'); }));
    expect((await refreshTokens('x')).kind).toBe('unavailable');
  });
});

describe('resolveAccess', () => {
  const mkJwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;
  const now = 1_800_000_000;

  it('uses a token that is not near expiry without calling authservice', async () => {
    stubAuth(() => pair(1));
    const r = await resolveAccess(mkJwt(now + 600), 'rt', now);
    expect(r).toEqual({ kind: 'token', accessToken: mkJwt(now + 600) });
    expect(calls).toHaveLength(0);
  });

  it('refreshes an expired or about-to-expire token and returns the rotated pair', async () => {
    stubAuth(() => pair(7));
    for (const exp of [now - 5, now + 10]) {
      resetRefreshState();
      const r = await resolveAccess(mkJwt(exp), 'rt', now);
      expect(r).toEqual({ kind: 'token', accessToken: 'a7', rotated: { accessToken: 'a7', refreshToken: 'r7' } });
    }
  });

  it('treats a failed refresh as signed out and asks for the cookies to be cleared', async () => {
    stubAuth(() => new Response('{}', { status: 401 }));
    expect(await resolveAccess(mkJwt(now - 5), 'rt', now)).toEqual({ kind: 'anonymous', clear: true });
  });

  it('is anonymous without any cookie', async () => {
    expect(await resolveAccess(undefined, undefined, now)).toEqual({ kind: 'anonymous', clear: false });
  });
});
