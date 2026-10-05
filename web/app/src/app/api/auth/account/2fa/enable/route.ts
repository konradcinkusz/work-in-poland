import type { NextRequest } from 'next/server';
import { json, sessionFor, upstreamFailure, errorList } from '@/lib/bff';
import { authRequest } from '@/lib/authservice';

/**
 * Starts 2FA enrolment: returns the shared secret and otpauth:// URI for QR rendering.
 * Requires authentication. The secret is not active until verify-setup succeeds.
 */
export async function POST(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.resolved.kind !== 'token') return session.apply(json({ status: 'unauthorized' }, 401));

  try {
    const res = await authRequest('/api/v1/auth/2fa/enable', {
      method: 'POST',
      token: session.accessToken ?? undefined,
    });

    if (res.status === 200) {
      return session.apply(
        json({
          status: 'ok',
          sharedKey: res.data.sharedKey,
          authenticatorUri: res.data.authenticatorUri,
        }),
      );
    }

    if (res.status === 400) {
      const errors = errorList(res.data);
      return session.apply(json({ status: 'already_enabled', error: errors[0] ?? 'Weryfikacja dwuetapowa już jest włączona.' }, 400));
    }

    if (res.status === 401) return session.apply(json({ status: 'unauthorized' }, 401));

    return session.apply(json({ status: 'error', error: 'Nie udało się uruchomić weryfikacji dwuetapowej.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
