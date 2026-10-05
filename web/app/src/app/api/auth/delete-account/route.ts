import type { NextRequest } from 'next/server';
import { clearChallengeCookie, clearSessionCookies } from '@/lib/cookies';
import { authRequest, json, rateLimited, readJson, sessionFor, upstreamFailure } from '@/lib/bff';

/**
 * Second step of "delete my data and account" (the first is `DELETE /api/v1/me/data` through the
 * proxy). Calls authservice `DELETE /api/v1/auth/account` — confirmation string plus the password,
 * which authservice skips for OAuth-only accounts — and on success deletes the session cookies.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const password = typeof body?.password === 'string' && body.password ? body.password : undefined;
  const session = await sessionFor(req);
  if (!session.accessToken) return session.apply(json({ status: 'signed_out' }, 401));
  try {
    const res = await authRequest('/api/v1/auth/account', {
      method: 'DELETE',
      token: session.accessToken,
      body: { password, confirmation: 'DELETE' },
    });
    if (res.status === 200) {
      const out = json({ status: 'ok' });
      clearSessionCookies(out);
      clearChallengeCookie(out);
      return out;
    }
    if (res.status === 400) {
      const msg = typeof res.data.error === 'string' ? res.data.error.toLowerCase() : '';
      return session.apply(json({ status: msg.includes('password') ? 'invalid_password' : 'invalid' }, 400));
    }
    if (res.status === 401) return session.apply(json({ status: 'signed_out' }, 401));
    if (res.status === 429) return rateLimited(res);
    return session.apply(json({ status: 'unavailable', error: 'Nie udało się usunąć konta.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
