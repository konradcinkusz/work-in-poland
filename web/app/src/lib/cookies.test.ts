import { afterEach, describe, expect, it } from 'vitest';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies, cookieAttributes, setSessionCookies, type CookieAttributes } from './cookies';

const env = process.env as Record<string, string | undefined>;
const original = { node: env.NODE_ENV, secure: env.SESSION_COOKIE_SECURE };
afterEach(() => {
  env.NODE_ENV = original.node;
  env.SESSION_COOKIE_SECURE = original.secure;
});

function writer() {
  const calls: { name: string; value: string; opts: CookieAttributes }[] = [];
  return { calls, cookies: { set: (name: string, value: string, opts: CookieAttributes) => void calls.push({ name, value, opts }) } };
}

describe('cookie attributes', () => {
  it('is httpOnly, strict, path / and secure outside development', () => {
    env.NODE_ENV = 'production';
    delete env.SESSION_COOKIE_SECURE;
    expect(cookieAttributes(60)).toEqual({ httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 60 });
  });
  it('is not secure in development (auto)', () => {
    env.NODE_ENV = 'development';
    expect(cookieAttributes(60).secure).toBe(false);
  });
  it('honours the SESSION_COOKIE_SECURE override', () => {
    env.NODE_ENV = 'production';
    env.SESSION_COOKIE_SECURE = 'false';
    expect(cookieAttributes(60).secure).toBe(false);
    env.NODE_ENV = 'development';
    env.SESSION_COOKIE_SECURE = 'true';
    expect(cookieAttributes(60).secure).toBe(true);
  });
  it('clears with exactly the attributes it sets with (only maxAge differs)', () => {
    env.NODE_ENV = 'production';
    const set = writer();
    const clear = writer();
    setSessionCookies(set, { accessToken: 'a', refreshToken: 'r' });
    clearSessionCookies(clear);
    expect(set.calls.map((c) => c.name)).toEqual([ACCESS_COOKIE, REFRESH_COOKIE]);
    expect(clear.calls.map((c) => c.name)).toEqual([ACCESS_COOKIE, REFRESH_COOKIE]);
    for (let i = 0; i < 2; i++) {
      const { maxAge: setAge, ...setRest } = set.calls[i]!.opts;
      const { maxAge: clearAge, ...clearRest } = clear.calls[i]!.opts;
      expect(clearRest).toEqual(setRest);
      expect(setAge).toBeGreaterThan(0);
      expect(clearAge).toBe(0);
      expect(clear.calls[i]!.value).toBe('');
    }
  });
});
