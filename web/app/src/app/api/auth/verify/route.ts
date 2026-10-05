import type { NextRequest } from 'next/server';
import { authRequest, json, rateLimited, readJson, str, upstreamFailure } from '@/lib/bff';

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = str(body?.email, 256);
  const token = str(body?.token, 4096);
  if (!email || !token) return json({ status: 'invalid' }, 400);
  try {
    const res = await authRequest('/api/v1/auth/verify-email', { method: 'POST', body: { email, token } });
    if (res.status === 200) return json({ status: 'ok' });
    if (res.status === 400) return json({ status: 'invalid' }, 400);
    if (res.status === 429) return rateLimited(res);
    return json({ status: 'unavailable' }, 502);
  } catch (e) {
    return upstreamFailure(e);
  }
}
