import type { NextRequest } from 'next/server';
import { json, sessionFor, upstreamFailure, readJson, str, errorList } from '@/lib/bff';
import { authRequest } from '@/lib/authservice';

/**
 * Updates the authenticated user's profile (username).
 */
export async function PUT(req: NextRequest) {
  const session = await sessionFor(req);
  if (session.resolved.kind !== 'token') return session.apply(json({ status: 'unauthorized' }, 401));

  const body = await readJson(req);
  const userName = str(body?.userName, 50);

  if (!userName) {
    return session.apply(json({ status: 'invalid', error: 'Podaj nazwę użytkownika.' }, 400));
  }

  try {
    const res = await authRequest('/api/v1/auth/profile', {
      method: 'PUT',
      token: session.accessToken ?? undefined,
      body: { userName: userName ?? '' },
    });

    if (res.status === 200) {
      return session.apply(json({ status: 'ok', message: 'Profil zaktualizowany pomyślnie.' }));
    }

    if (res.status === 400) {
      const errors = errorList(res.data);
      return session.apply(json({ status: 'invalid', error: errors[0] ?? 'Nieprawidłowa nazwa użytkownika.' }, 400));
    }

    if (res.status === 401) return session.apply(json({ status: 'unauthorized' }, 401));

    if (res.status === 404) return session.apply(json({ status: 'not_found' }, 404));

    return session.apply(json({ status: 'error', error: 'Aktualizacja profilu nie powiodła się.' }, 502));
  } catch (e) {
    return upstreamFailure(e);
  }
}
