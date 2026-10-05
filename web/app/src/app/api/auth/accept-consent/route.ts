import type { NextRequest } from 'next/server';
import { authRequest, json, readJson, sessionFor, upstreamFailure } from '@/lib/bff';

/** Records re-acceptance of the CURRENT Terms and Privacy versions (authservice decides which are current). */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (body?.acceptedTerms !== true || body?.acceptedPrivacy !== true) {
    return json({ status: 'invalid', error: 'Zaakceptuj regulamin i politykę prywatności.' }, 400);
  }
  const session = await sessionFor(req);
  if (!session.accessToken) return session.apply(json({ status: 'signed_out' }, 401));
  try {
    const res = await authRequest('/api/v1/auth/consents', {
      method: 'POST',
      token: session.accessToken,
      body: { acceptedTerms: true, acceptedPrivacy: true, locale: 'pl' },
    });
    if (res.status === 200) return session.apply(json({ status: 'ok', requiresConsent: res.data.requiresConsent === true }));
    if (res.status === 401) return session.apply(json({ status: 'signed_out' }, 401));
    return session.apply(json({ status: 'unavailable', error: 'Nie udało się zapisać zgód.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
