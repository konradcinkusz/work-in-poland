import type { NextRequest } from 'next/server';
import { json, sessionFor, upstreamFailure, readJson, str, errorList } from '@/lib/bff';
import { authRequest } from '@/lib/authservice';

/**
 * Disables 2FA. Requires the current password AND a live authenticator code (or recovery code).
 * This ensures a stolen session alone cannot remove 2FA protection.
 */
export async function POST(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.resolved.kind !== 'token') return session.apply(json({ status: 'unauthorized' }, 401));

  const body = await readJson(req);
  const password = str(body?.password, 200);
  const code = str(body?.code, 64);

  if (!password || !code) {
    return session.apply(json({ status: 'invalid', error: 'Podaj hasło i kod weryfikacyjny.' }, 400));
  }

  try {
    const res = await authRequest('/api/v1/auth/2fa/disable', {
      method: 'POST',
      token: session.accessToken ?? undefined,
      body: { password: password ?? '', code: code ?? '' },
    });

    if (res.status === 200) {
      return session.apply(json({ status: 'ok', message: 'Weryfikacja dwuetapowa wyłączona. Wszystkie sesje zostały wylogowane.' }));
    }

    if (res.status === 400) {
      const errors = errorList(res.data);
      const error = errors[0] ?? 'Nieprawidłowe hasło lub kod.';
      return session.apply(json({ status: 'invalid', error }, 400));
    }

    if (res.status === 401) return session.apply(json({ status: 'unauthorized' }, 401));

    return session.apply(json({ status: 'error', error: 'Nie udało się wyłączyć weryfikacji dwuetapowej.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
