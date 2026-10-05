import type { NextRequest } from 'next/server';
import { json, sessionFor, upstreamFailure, readJson, str, errorList, setSessionCookies } from '@/lib/bff';
import { authRequest, readTokens } from '@/lib/authservice';

/**
 * Changes the authenticated user's password.
 * authservice revokes all other sessions and by default reissues tokens so the calling session survives.
 * We must update the token cookies with the new pair.
 */
export async function POST(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.resolved.kind !== 'token') return session.apply(json({ status: 'unauthorized' }, 401));

  const body = await readJson(req);
  const currentPassword = str(body?.currentPassword, 200);
  const newPassword = str(body?.newPassword, 200);

  if (!currentPassword || !newPassword) {
    return session.apply(json({ status: 'invalid', error: 'Podaj bieżące hasło i nowe hasło.' }, 400));
  }

  try {
    const res = await authRequest('/api/v1/auth/change-password', {
      method: 'POST',
      token: session.accessToken ?? undefined,
      body: { currentPassword: currentPassword ?? '', newPassword: newPassword ?? '' },
    });

    if (res.status === 200) {
      const out = session.apply(json({ status: 'ok', message: res.data.message ?? 'Hasło zmienione pomyślnie.' }));
      // authservice reissues tokens when configured with ReissueTokensOnPasswordChange=true
      if (res.data.tokens && typeof res.data.tokens === 'object') {
        const newTokens = readTokens(res.data.tokens as Record<string, unknown>);
        if (newTokens) setSessionCookies(out, newTokens);
      }
      return out;
    }

    if (res.status === 400) {
      const errors = errorList(res.data);
      return session.apply(json({ status: 'invalid', error: errors[0] ?? 'Podaj prawidłowe hasła.' }, 400));
    }

    if (res.status === 401) return session.apply(json({ status: 'unauthorized' }, 401));

    if (res.status === 404) return session.apply(json({ status: 'not_found' }, 404));

    return session.apply(json({ status: 'error', error: 'Zmiana hasła nie powiodła się.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
