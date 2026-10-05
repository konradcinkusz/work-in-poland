import type { NextRequest } from 'next/server';
import { json, sessionFor, upstreamFailure } from '@/lib/bff';
import { authRequest } from '@/lib/authservice';

/**
 * Returns the authenticated user's profile information.
 * Used by the web UI to determine available features (2FA, password).
 */
export async function GET(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.resolved.kind !== 'token') return session.apply(json({ status: 'unauthorized' }, 401));

  try {
    const res = await authRequest('/api/v1/auth/me', {
      method: 'GET',
      token: session.accessToken ?? undefined,
    });

    if (res.status === 200) {
      return session.apply(
        json({
          id: res.data.id,
          email: res.data.email,
          userName: res.data.userName,
          hasPassword: res.data.hasPassword ?? false,
          twoFactorEnabled: res.data.twoFactorEnabled ?? false,
          emailConfirmed: res.data.emailConfirmed ?? true,
        }),
      );
    }

    if (res.status === 401) return session.apply(json({ status: 'unauthorized' }, 401));

    if (res.status === 404) return session.apply(json({ status: 'not_found' }, 404));

    return session.apply(json({ status: 'error', error: 'Nie udało się załadować profilu użytkownika.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
