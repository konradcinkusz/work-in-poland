import type { NextRequest } from 'next/server';
import { authRequest, errorList, json, rateLimited, readJson, str, upstreamFailure } from '@/lib/bff';

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = str(body?.email, 256);
  const token = str(body?.token, 4096);
  const newPassword = str(body?.newPassword, 100);
  if (!email || !token || !newPassword) return json({ status: 'invalid', errors: ['Link jest niekompletny lub hasło jest puste.'] }, 400);
  try {
    const res = await authRequest('/api/v1/auth/reset-password', { method: 'POST', body: { email, token, newPassword } });
    if (res.status === 200) return json({ status: 'ok' });
    if (res.status === 400) return json({ status: 'invalid', errors: errorList(res.data) }, 400);
    if (res.status === 429) return rateLimited(res);
    return json({ status: 'unavailable', error: 'Nie udało się zmienić hasła.' }, 502);
  } catch (e) {
    return upstreamFailure(e);
  }
}
