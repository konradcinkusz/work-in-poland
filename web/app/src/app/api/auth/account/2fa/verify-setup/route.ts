import type { NextRequest } from 'next/server';
import { json, sessionFor, upstreamFailure, readJson, str, errorList } from '@/lib/bff';
import { authRequest } from '@/lib/authservice';

/**
 * Confirms the first authenticator code and activates 2FA.
 * Returns recovery codes which should be shown exactly once.
 */
export async function POST(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.resolved.kind !== 'token') return session.apply(json({ status: 'unauthorized' }, 401));

  const body = await readJson(req);
  const code = str(body?.code, 16);
  if (!code) return session.apply(json({ status: 'invalid', error: 'Podaj kod weryfikacyjny.' }, 400));

  try {
    const res = await authRequest('/api/v1/auth/2fa/verify', {
      method: 'POST',
      token: session.accessToken ?? undefined,
      body: { code: code ?? '' },
    });

    if (res.status === 200) {
      const codes = Array.isArray(res.data.recoveryCodes) ? (res.data.recoveryCodes as string[]) : [];
      return session.apply(
        json({
          status: 'ok',
          recoveryCodes: codes,
        }),
      );
    }

    if (res.status === 400) {
      const errors = errorList(res.data);
      return session.apply(json({ status: 'invalid_code', error: errors[0] ?? 'Kod jest nieprawidłowy.' }, 400));
    }

    if (res.status === 401) return session.apply(json({ status: 'unauthorized' }, 401));

    return session.apply(json({ status: 'error', error: 'Weryfikacja nie powiodła się.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
