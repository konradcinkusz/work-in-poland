import type { NextRequest } from 'next/server';
import { CHALLENGE_COOKIE, clearChallengeCookie, setSessionCookies } from '@/lib/cookies';
import { authRequest, json, rateLimited, readJson, str, upstreamFailure } from '@/lib/bff';
import { readTokens } from '@/lib/authservice';

/** Second step of sign-in: TOTP `code` or single-use `recoveryCode` + the challenge held in a cookie. */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const code = str(body?.code, 16);
  const recoveryCode = str(body?.recoveryCode, 64);
  if (!code && !recoveryCode) return json({ status: 'invalid', error: 'Podaj kod.' }, 400);

  const challengeToken = req.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!challengeToken) return json({ status: 'challenge_expired' }, 401);

  try {
    const res = await authRequest('/api/v1/auth/2fa/login', {
      method: 'POST',
      body: code ? { challengeToken, code } : { challengeToken, recoveryCode },
    });
    if (res.status === 200) {
      const tokens = readTokens(res.data);
      if (!tokens) return json({ status: 'unavailable', error: 'Nieoczekiwana odpowiedź usługi logowania.' }, 502);
      const out = json({ status: 'ok' });
      setSessionCookies(out, tokens);
      clearChallengeCookie(out);
      return out;
    }
    if (res.status === 401) {
      const message = typeof res.data.error === 'string' ? res.data.error.toLowerCase() : '';
      if (message.includes('locked')) return json({ status: 'locked_out' }, 423);
      if (message.includes('challenge')) {
        const out = json({ status: 'challenge_expired' }, 401);
        clearChallengeCookie(out);
        return out;
      }
      return json({ status: 'invalid_code' }, 401);
    }
    if (res.status === 429) return rateLimited(res);
    if (res.status === 400) return json({ status: 'invalid', error: 'Podaj kod.' }, 400);
    return json({ status: 'unavailable', error: 'Weryfikacja nie powiodła się. Spróbuj ponownie.' }, 502);
  } catch (e) {
    return upstreamFailure(e);
  }
}
