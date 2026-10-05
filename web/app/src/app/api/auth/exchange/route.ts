import type { NextRequest } from 'next/server';
import { POST_LOGIN_COOKIE, cookieAttributes, setChallengeCookie, setSessionCookies } from '@/lib/cookies';
import { authRequest, json, rateLimited, readJson, str, upstreamFailure } from '@/lib/bff';
import { readTokens } from '@/lib/authservice';
import { safeRedirect } from '@/lib/redirect';

/** Redeems the single-use social-login code from `/oauth/callback?code=`; handles the 2FA branch. */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const code = str(body?.code, 512);
  if (!code) return json({ status: 'invalid_code' }, 400);
  const redirect = safeRedirect(req.cookies.get(POST_LOGIN_COOKIE)?.value, '/');

  try {
    const res = await authRequest('/api/v1/external-auth/exchange', { method: 'POST', body: { code } });
    if (res.status === 200) {
      const tokens = readTokens(res.data);
      if (tokens) {
        const out = json({ status: 'ok', redirect });
        setSessionCookies(out, tokens);
        out.cookies.set(POST_LOGIN_COOKIE, '', cookieAttributes(0, undefined, 'lax'));
        return out;
      }
      if (res.data.requiresTwoFactor === true && typeof res.data.challengeToken === 'string') {
        const out = json({ status: 'two_factor', redirect });
        setChallengeCookie(out, res.data.challengeToken);
        return out;
      }
      return json({ status: 'unavailable', error: 'Nieoczekiwana odpowiedź usługi logowania.' }, 502);
    }
    if (res.status === 400 || res.status === 401) return json({ status: 'invalid_code' }, 401);
    if (res.status === 429) return rateLimited(res);
    return json({ status: 'unavailable', error: 'Logowanie nie powiodło się.' }, 502);
  } catch (e) {
    return upstreamFailure(e);
  }
}
