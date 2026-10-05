import type { NextRequest } from 'next/server';
import { json, sessionFor, upstreamFailure, errorList } from '@/lib/bff';
import { authRequest } from '@/lib/authservice';

/**
 * Regenerates recovery codes for 2FA. Requires 2FA to be already enabled.
 * Recovery codes should be shown exactly once.
 */
export async function POST(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.resolved.kind !== 'token') return session.apply(json({ status: 'unauthorized' }, 401));

  try {
    const res = await authRequest('/api/v1/auth/2fa/recovery-codes', {
      method: 'POST',
      token: session.accessToken ?? undefined,
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
      return session.apply(json({ status: 'not_enabled', error: errors[0] ?? 'Weryfikacja dwuetapowa nie jest włączona.' }, 400));
    }

    if (res.status === 401) return session.apply(json({ status: 'unauthorized' }, 401));

    return session.apply(json({ status: 'error', error: 'Nie udało się wygenerować kodów odzyskiwania.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
