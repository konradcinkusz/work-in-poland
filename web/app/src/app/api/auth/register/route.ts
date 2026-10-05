import type { NextRequest } from 'next/server';
import { setSessionCookies } from '@/lib/cookies';
import { authRequest, errorList, json, rateLimited, readJson, str, upstreamFailure } from '@/lib/bff';
import { readTokens } from '@/lib/authservice';

/**
 * Registration. The document VERSIONS being accepted are fetched here from authservice
 * (`GET /consents/versions`) — never hard-coded and never taken from the client; the client only
 * says that the boxes were ticked.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = str(body?.email, 256);
  const password = str(body?.password, 100);
  if (!email || !password) return json({ status: 'invalid', errors: ['Podaj e-mail i hasło.'] }, 400);
  if (body?.acceptTerms !== true || body?.acceptPrivacy !== true) {
    return json({ status: 'invalid', errors: ['Zaakceptuj regulamin i politykę prywatności.'] }, 400);
  }

  try {
    const versions = await authRequest('/api/v1/auth/consents/versions');
    const terms = str(versions.data.terms, 50);
    const privacy = str(versions.data.privacy, 50);
    if (versions.status !== 200 || !terms || !privacy) {
      return json({ status: 'unavailable', error: 'Nie udało się pobrać wersji dokumentów. Spróbuj ponownie.' }, 503);
    }
    const res = await authRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, acceptedTermsVersion: terms, acceptedPrivacyVersion: privacy, locale: 'pl' },
    });
    if (res.status === 200) {
      const tokens = readTokens(res.data);
      if (!tokens) return json({ status: 'unavailable', error: 'Nieoczekiwana odpowiedź usługi.' }, 502);
      const out = json({ status: 'ok' });
      setSessionCookies(out, tokens);
      return out;
    }
    if (res.status === 202) return json({ status: 'verification_required', email }, 202);
    if (res.status === 400) return json({ status: 'invalid', errors: errorList(res.data) }, 400);
    if (res.status === 429) return rateLimited(res);
    return json({ status: 'unavailable', error: 'Rejestracja nie powiodła się. Spróbuj ponownie.' }, 502);
  } catch (e) {
    return upstreamFailure(e);
  }
}
