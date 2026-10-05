import type { NextRequest } from 'next/server';
import { clearChallengeCookie, clearSessionCookies } from '@/lib/cookies';
import { authRequest, AuthUpstreamError, json, sessionFor } from '@/lib/bff';

/** Revokes the refresh family at authservice (best effort) and deletes the cookies with the attributes they were set with. */
export async function POST(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.accessToken) {
    try {
      await authRequest('/api/v1/auth/logout', { method: 'POST', token: session.accessToken });
    } catch (e) {
      if (!(e instanceof AuthUpstreamError)) throw e;
      // The local sign-out must succeed even when authservice is down; the refresh token then ages out.
    }
  }
  const out = json({ status: 'ok' });
  clearSessionCookies(out);
  clearChallengeCookie(out);
  return out;
}
