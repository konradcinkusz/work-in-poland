import type { NextRequest } from 'next/server';
import { clearChallengeCookie, setChallengeCookie, setSessionCookies } from '@/lib/cookies';
import { authRequest, json, rateLimited, readJson, str, upstreamFailure } from '@/lib/bff';
import { readTokens } from '@/lib/authservice';

/**
 * Sign in. The response never distinguishes "unknown user" from "wrong password" (authservice
 * answers both with the same 401). Tokens go into httpOnly cookies and never reach client JS;
 * the 2FA challenge token is parked in an httpOnly cookie as well.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = str(body?.email, 256);
  const password = str(body?.password, 200);
  if (!email || !password) return json({ status: 'invalid', error: 'Podaj e-mail i hasło.' }, 400);

  try {
    const res = await authRequest('/api/v1/auth/login', { method: 'POST', body: { email, password } });
    if (res.status === 200) {
      const tokens = readTokens(res.data);
      if (tokens) {
        const out = json({ status: 'ok' });
        setSessionCookies(out, tokens);
        clearChallengeCookie(out);
        return out;
      }
      if (res.data.requiresTwoFactor === true && typeof res.data.challengeToken === 'string') {
        const out = json({ status: 'two_factor' });
        setChallengeCookie(out, res.data.challengeToken);
        return out;
      }
      return json({ status: 'unavailable', error: 'Nieoczekiwana odpowiedź usługi logowania.' }, 502);
    }
    if (res.status === 401) {
      if (res.data.lockedOut === true) return json({ status: 'locked_out', lockoutEnd: res.data.lockoutEnd ?? null }, 423);
      return json({ status: 'invalid_credentials' }, 401);
    }
    if (res.status === 403 && res.data.emailVerificationRequired === true) return json({ status: 'email_not_verified' }, 403);
    if (res.status === 429) return rateLimited(res);
    if (res.status === 400) return json({ status: 'invalid', error: 'Podaj poprawny e-mail i hasło.' }, 400);
    return json({ status: 'unavailable', error: 'Logowanie nie powiodło się. Spróbuj ponownie.' }, 502);
  } catch (e) {
    return upstreamFailure(e);
  }
}
